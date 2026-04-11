import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

const schoolA = {
  schoolName: 'Crest Academy',
  schoolEmail: 'admin@crest.sc.ke',
  schoolPhone: '0715000001',
  county: 'Nairobi',
  firstName: 'Joan',
  lastName: 'Naliaka',
  email: 'joan@crest.sc.ke',
  phone: '0715000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Delta School',
  schoolEmail: 'admin@delta.sc.ke',
  schoolPhone: '0715000002',
  county: 'Mombasa',
  firstName: 'Sam',
  lastName: 'Kiptoo',
  email: 'sam@delta.sc.ke',
  phone: '0715000002',
  password: 'SecurePass1!',
};

async function registerAndLogin(schoolData) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send(schoolData);
  return agent;
}

async function createClass(agent, overrides = {}) {
  const res = await agent.post('/api/v1/classes').send({
    name: 'Grade 6',
    levelCategory: 'Upper Primary',
    academicYear: '2025',
    term: 'Term 1',
    ...overrides,
  });
  return res.body.class;
}

async function createSubject(agent, classId, name = 'Mathematics') {
  const res = await agent.post('/api/v1/subjects').send({ classId, name });
  return res.body.subject;
}

let admissionCounter = 1;
function nextAdmission() {
  return `RSL${String(admissionCounter++).padStart(4, '0')}`;
}

async function enrollStudent(agent, classId, overrides = {}) {
  const res = await agent.post('/api/v1/students').send({
    classId,
    admissionNumber: nextAdmission(),
    firstName: 'Learner',
    lastName: `No${admissionCounter}`,
    gender: 'male',
    ...overrides,
  });
  return res.body.student;
}

async function createExam(agent, classId, subjectId, overrides = {}) {
  const res = await agent.post('/api/v1/exams').send({
    classId,
    subjectId,
    name: 'Midterm',
    type: 'midterm',
    totalMarks: 100,
    ...overrides,
  });
  return res.body.exam;
}

describe('POST /api/v1/results/bulk', () => {
  it('computes 4-level CBC grades for Upper Primary', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent, { levelCategory: 'Upper Primary' });
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'A' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'B' });
    const s3 = await enrollStudent(agent, cls._id, { firstName: 'C' });
    const s4 = await enrollStudent(agent, cls._id, { firstName: 'D' });

    const res = await agent.post('/api/v1/results/bulk').send({
      examId: exam._id,
      entries: [
        { studentId: s1._id, marks: 80 },
        { studentId: s2._id, marks: 60 },
        { studentId: s3._id, marks: 30 },
        { studentId: s4._id, marks: 10 },
      ],
    });

    expect(res.status).toBe(201);
    const byStudent = new Map(res.body.results.map((r) => [r.studentId, r]));
    expect(byStudent.get(s1._id).grade).toBe('EE');
    expect(byStudent.get(s2._id).grade).toBe('ME');
    expect(byStudent.get(s3._id).grade).toBe('AE');
    expect(byStudent.get(s4._id).grade).toBe('BE');
  });

  it('computes 8-level CBC grades for Junior Secondary', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent, {
      name: 'Grade 8',
      levelCategory: 'Junior Secondary',
    });
    const subject = await createSubject(agent, cls._id, 'Integrated Science');
    const exam = await createExam(agent, cls._id, subject._id);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Top' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Mid' });
    const s3 = await enrollStudent(agent, cls._id, { firstName: 'Low' });

    const res = await agent.post('/api/v1/results/bulk').send({
      examId: exam._id,
      entries: [
        { studentId: s1._id, marks: 92 },
        { studentId: s2._id, marks: 60 },
        { studentId: s3._id, marks: 18 },
      ],
    });

    expect(res.status).toBe(201);
    const byStudent = new Map(res.body.results.map((r) => [r.studentId, r]));
    expect(byStudent.get(s1._id).grade).toBe('EE1');
    expect(byStudent.get(s2._id).grade).toBe('ME1');
    expect(byStudent.get(s3._id).grade).toBe('BE1');
  });

  it('rejects marks above exam total', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id, { totalMarks: 50 });
    const s1 = await enrollStudent(agent, cls._id);

    const res = await agent.post('/api/v1/results/bulk').send({
      examId: exam._id,
      entries: [{ studentId: s1._id, marks: 60 }],
    });

    expect(res.status).toBe(400);
  });
});

describe('GET/PATCH /api/v1/results', () => {
  it('lists results and enforces tenant isolation', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const cls = await createClass(agentA);
    const subject = await createSubject(agentA, cls._id);
    const exam = await createExam(agentA, cls._id, subject._id);
    const student = await enrollStudent(agentA, cls._id);

    await agentA.post('/api/v1/results/bulk').send({
      examId: exam._id,
      entries: [{ studentId: student._id, marks: 70 }],
    });

    const listA = await agentA.get(`/api/v1/results?examId=${exam._id}`);
    expect(listA.status).toBe(200);
    expect(listA.body.results.length).toBe(1);

    const listB = await agentB.get('/api/v1/results');
    expect(listB.status).toBe(200);
    expect(listB.body.results.length).toBe(0);
  });

  it('updates marks and recomputes grade', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    const student = await enrollStudent(agent, cls._id);

    const bulkRes = await agent.post('/api/v1/results/bulk').send({
      examId: exam._id,
      entries: [{ studentId: student._id, marks: 40 }],
    });
    const resultId = bulkRes.body.results[0]._id;
    expect(bulkRes.body.results[0].grade).toBe('AE');

    const patchRes = await agent.patch(`/api/v1/results/${resultId}`).send({ marks: 78 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.result.grade).toBe('EE');
    expect(patchRes.body.result.points).toBe(4);
  });
});
