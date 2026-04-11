import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

const schoolA = {
  schoolName: 'Bright Academy',
  schoolEmail: 'admin@bright.sc.ke',
  schoolPhone: '0714000001',
  county: 'Nairobi',
  firstName: 'Anne',
  lastName: 'Wairimu',
  email: 'anne@bright.sc.ke',
  phone: '0714000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Horizon School',
  schoolEmail: 'admin@horizon.sc.ke',
  schoolPhone: '0714000002',
  county: 'Kisumu',
  firstName: 'Brian',
  lastName: 'Otieno',
  email: 'brian@horizon.sc.ke',
  phone: '0714000002',
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

async function createSubject(agent, classId, overrides = {}) {
  const res = await agent.post('/api/v1/subjects').send({
    classId,
    name: 'Mathematics',
    ...overrides,
  });
  return res.body.subject;
}

describe('POST /api/v1/exams', () => {
  it('creates an exam for class + subject', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);

    const res = await agent.post('/api/v1/exams').send({
      classId: cls._id,
      subjectId: subject._id,
      name: 'Mathematics Midterm',
      type: 'midterm',
      totalMarks: 100,
    });

    expect(res.status).toBe(201);
    expect(res.body.exam.term).toBe('Term 1');
    expect(res.body.exam.academicYear).toBe('2025');
    expect(res.body.exam.levelCategory).toBe('Upper Primary');
  });

  it('rejects subject that does not belong to class', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls1 = await createClass(agent, { name: 'Grade 6' });
    const cls2 = await createClass(agent, { name: 'Grade 7', levelCategory: 'Junior Secondary' });
    const subjectFromCls2 = await createSubject(agent, cls2._id, { name: 'Biology' });

    const res = await agent.post('/api/v1/exams').send({
      classId: cls1._id,
      subjectId: subjectFromCls2._id,
      name: 'Wrong Link',
      type: 'opener',
      totalMarks: 50,
    });

    expect(res.status).toBe(404);
  });

  it('rejects exams for Pre-Primary class', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent, {
      name: 'PP1',
      levelCategory: 'Pre-Primary',
    });

    const res = await agent.post('/api/v1/exams').send({
      classId: cls._id,
      subjectId: '000000000000000000000001',
      name: 'Observation',
      type: 'sba',
      totalMarks: 20,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pre-primary/i);
  });
});

describe('GET /api/v1/exams', () => {
  it('lists exams and filters by classId', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls1 = await createClass(agent, { name: 'Grade 6' });
    const cls2 = await createClass(agent, { name: 'Grade 7', levelCategory: 'Junior Secondary' });
    const sub1 = await createSubject(agent, cls1._id, { name: 'Math' });
    const sub2 = await createSubject(agent, cls2._id, { name: 'Biology' });

    await agent.post('/api/v1/exams').send({
      classId: cls1._id, subjectId: sub1._id, name: 'Exam A', type: 'midterm', totalMarks: 100,
    });
    await agent.post('/api/v1/exams').send({
      classId: cls2._id, subjectId: sub2._id, name: 'Exam B', type: 'midterm', totalMarks: 100,
    });

    const res = await agent.get(`/api/v1/exams?classId=${cls1._id}`);
    expect(res.status).toBe(200);
    expect(res.body.exams.length).toBe(1);
    expect(res.body.exams[0].classId._id).toBe(cls1._id);
  });

  it('enforces tenant isolation on list', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const cls = await createClass(agentA);
    const subject = await createSubject(agentA, cls._id);
    await agentA.post('/api/v1/exams').send({
      classId: cls._id, subjectId: subject._id, name: 'Term Exam', type: 'endterm', totalMarks: 100,
    });

    const res = await agentB.get('/api/v1/exams');
    expect(res.status).toBe(200);
    expect(res.body.exams.length).toBe(0);
  });
});

describe('PATCH/DELETE /api/v1/exams/:id', () => {
  it('updates exam metadata', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);
    const createRes = await agent.post('/api/v1/exams').send({
      classId: cls._id, subjectId: subject._id, name: 'CAT 1', type: 'opener', totalMarks: 30,
    });
    const examId = createRes.body.exam._id;

    const patchRes = await agent.patch(`/api/v1/exams/${examId}`).send({
      name: 'CAT 1 Updated',
      totalMarks: 40,
      isPublished: true,
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.exam.name).toBe('CAT 1 Updated');
    expect(patchRes.body.exam.totalMarks).toBe(40);
    expect(patchRes.body.exam.isPublished).toBe(true);
  });

  it('blocks totalMarks change when results already recorded', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);

    const createRes = await agent.post('/api/v1/exams').send({
      classId: cls._id, subjectId: subject._id, name: 'Term Exam', type: 'endterm', totalMarks: 100,
    });
    const examId = createRes.body.exam._id;

    // Enroll a student and record a result
    const studentRes = await agent.post('/api/v1/students').send({
      classId: cls._id,
      admissionNumber: 'EXAM001',
      firstName: 'Grace',
      lastName: 'Akinyi',
      gender: 'female',
    });
    await agent.post('/api/v1/results/bulk').send({
      examId,
      entries: [{ studentId: studentRes.body.student._id, marks: 75 }],
    });

    // Now attempt to change totalMarks — should be blocked
    const patchRes = await agent.patch(`/api/v1/exams/${examId}`).send({ totalMarks: 80 });
    expect(patchRes.status).toBe(409);
    expect(patchRes.body.message).toMatch(/result/i);
  });

  it('deletes exam with no results', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const subject = await createSubject(agent, cls._id);
    const createRes = await agent.post('/api/v1/exams').send({
      classId: cls._id, subjectId: subject._id, name: 'CAT 2', type: 'opener', totalMarks: 20,
    });
    const examId = createRes.body.exam._id;

    const delRes = await agent.delete(`/api/v1/exams/${examId}`);
    expect(delRes.status).toBe(200);
  });
});
