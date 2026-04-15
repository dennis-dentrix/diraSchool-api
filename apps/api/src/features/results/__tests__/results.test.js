/**
 * Results integration tests.
 * Tests bulk upsert, list, get, and update.
 * BullMQ queues mocked to prevent Redis connections during tests.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { setup, clearDatabase, teardown } from '../../../config/vitest.setup.js';
import User from '../../users/User.model.js';
import Class from '../../classes/Class.model.js';
import Subject from '../../subjects/Subject.model.js';
import Student from '../../students/Student.model.js';
import Exam from '../../exams/Exam.model.js';
import { LEVEL_CATEGORIES, EXAM_TYPES } from '../../../constants/index.js';

vi.mock('../../../jobs/queues.js', () => ({
  smsQueue:     { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  reportQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  receiptQueue: { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  importQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  emailQueue:   { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
}));

const BASE      = '/api/v1/results';
const AUTH_BASE = '/api/v1/auth';

beforeAll(async () => { await setup(); });
beforeEach(async () => { await clearDatabase(); });  // ensure clean slate at the start of every test
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await teardown(); });

// ── Fixture builder ───────────────────────────────────────────────────────────

const buildFixtures = async () => {
  const regRes = await request(app).post(`${AUTH_BASE}/register`).send({
    schoolName:  'Results Test School',
    schoolEmail: 'school@resultstest.co.ke',
    schoolPhone: '0722222222',
    firstName:   'Admin',
    lastName:    'Results',
    email:       'admin@resultstest.co.ke',
    phone:       '0722222223',
    password:    'password123',
  });

  const { school } = regRes.body;

  // Bypass email verification for tests
  await User.updateOne(
    { email: 'admin@resultstest.co.ke' },
    { $set: { emailVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpiry: 1 } }
  );

  const agent = request.agent(app);
  await agent.post(`${AUTH_BASE}/login`).send({
    email: 'admin@resultstest.co.ke',
    password: 'password123',
  });

  const cls = await Class.create({
    schoolId:      school._id,
    name:          'Grade 7',
    levelCategory: LEVEL_CATEGORIES.JUNIOR_SECONDARY,
    academicYear:  '2025',
    term:          'Term 1',
  });

  const subject = await Subject.create({
    schoolId: school._id,
    classId:  cls._id,
    name:     'Mathematics',
    code:     'MATH',
  });

  const students = await Student.insertMany([
    { schoolId: school._id, classId: cls._id, admissionNumber: 'R001', firstName: 'Bob',   lastName: 'Otieno', gender: 'male' },
    { schoolId: school._id, classId: cls._id, admissionNumber: 'R002', firstName: 'Carol', lastName: 'Wanjiku', gender: 'female' },
  ]);

  const exam = await Exam.create({
    schoolId:      school._id,
    classId:       cls._id,
    subjectId:     subject._id,
    name:          'Math Endterm',
    type:          EXAM_TYPES.ENDTERM,
    totalMarks:    100,
    levelCategory: LEVEL_CATEGORIES.JUNIOR_SECONDARY,
    academicYear:  '2025',
    term:          'Term 1',
  });

  return { agent, school, cls, subject, students, exam };
};

// ── Bulk upsert ───────────────────────────────────────────────────────────────

describe('POST /results/bulk', () => {
  it('creates results and auto-computes CBC grade + points', async () => {
    const { agent, exam, students } = await buildFixtures();

    const res = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [
        { studentId: students[0]._id, marks: 88 },
        { studentId: students[1]._id, marks: 55 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.results).toHaveLength(2);

    const bob = res.body.results.find((r) => r.marks === 88);
    expect(bob.percentage).toBe(88);
    expect(bob.grade).toBeTruthy();
    expect(bob.points).toBeGreaterThan(0);
  });

  it('returns 400 when marks exceed exam totalMarks', async () => {
    const { agent, exam, students } = await buildFixtures();

    const res = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 150 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceed/i);
  });

  it('returns 404 for an unknown exam', async () => {
    const { agent, students } = await buildFixtures();

    const res = await agent.post(`${BASE}/bulk`).send({
      examId: '64a1b2c3d4e5f6a7b8c9d0e1',
      entries: [{ studentId: students[0]._id, marks: 70 }],
    });

    expect(res.status).toBe(404);
  });

  it('upserts — re-submitting the same student updates the result', async () => {
    const { agent, exam, students } = await buildFixtures();

    await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 40 }],
    });

    const res = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 75 }],
    });

    expect(res.status).toBe(201);
    const updated = res.body.results.find((r) => r.marks === 75);
    expect(updated).toBeDefined();
  });
});

// ── List results ──────────────────────────────────────────────────────────────

describe('GET /results', () => {
  it('lists results scoped to the school', async () => {
    const { agent, exam, students } = await buildFixtures();

    await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [
        { studentId: students[0]._id, marks: 60 },
        { studentId: students[1]._id, marks: 80 },
      ],
    });

    const res = await agent.get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by examId', async () => {
    const { agent, exam, students } = await buildFixtures();

    await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 50 }],
    });

    const res = await agent.get(BASE).query({ examId: exam._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.results.every((r) => r.examId._id === exam._id.toString())).toBe(true);
  });
});

// ── Get + Update ──────────────────────────────────────────────────────────────

describe('GET /results/:id', () => {
  it('returns a single result with populated refs', async () => {
    const { agent, exam, students } = await buildFixtures();

    const bulkRes = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 70 }],
    });

    const resultId = bulkRes.body.results[0]._id;
    const res = await agent.get(`${BASE}/${resultId}`);

    expect(res.status).toBe(200);
    expect(res.body.result.studentId).toBeDefined();
    expect(res.body.result.marks).toBe(70);
  });

  it('returns 404 for an unknown result ID', async () => {
    const { agent } = await buildFixtures();
    const res = await agent.get(`${BASE}/64a1b2c3d4e5f6a7b8c9d0e1`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /results/:id', () => {
  it('updates marks and recomputes grade', async () => {
    const { agent, exam, students } = await buildFixtures();

    const bulkRes = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 30 }],
    });

    const resultId = bulkRes.body.results[0]._id;
    const res = await agent.patch(`${BASE}/${resultId}`).send({ marks: 92 });

    expect(res.status).toBe(200);
    expect(res.body.result.marks).toBe(92);
    expect(res.body.result.percentage).toBe(92);
  });

  it('returns 400 when marks exceed totalMarks', async () => {
    const { agent, exam, students } = await buildFixtures();

    const bulkRes = await agent.post(`${BASE}/bulk`).send({
      examId: exam._id,
      entries: [{ studentId: students[0]._id, marks: 50 }],
    });

    const resultId = bulkRes.body.results[0]._id;
    const res = await agent.patch(`${BASE}/${resultId}`).send({ marks: 200 });
    expect(res.status).toBe(400);
  });
});
