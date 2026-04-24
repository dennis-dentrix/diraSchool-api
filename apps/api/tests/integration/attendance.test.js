import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';
import { registerAndLogin } from './helpers.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

const schoolA = {
  schoolName: 'Summit Academy',
  schoolEmail: 'admin@summit.sc.ke',
  schoolPhone: '0721000001',
  county: 'Nairobi',
  firstName: 'Lucy',
  lastName: 'Njeri',
  email: 'lucy@summit.sc.ke',
  phone: '0721000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Valley School',
  schoolEmail: 'admin@valley.sc.ke',
  schoolPhone: '0721000002',
  county: 'Kiambu',
  firstName: 'David',
  lastName: 'Kimutai',
  email: 'david@valley.sc.ke',
  phone: '0721000002',
  password: 'SecurePass1!',
};

const classPayload = {
  name: 'Grade 4',
  levelCategory: 'Upper Primary',
  academicYear: '2025',
  term: 'Term 1',
};

async function createClass(agent, overrides = {}) {
  const res = await agent.post('/api/v1/classes').send({ ...classPayload, ...overrides });
  return res.body.class;
}

let admissionCounter = 1;
function nextAdmission() {
  return `ATD${String(admissionCounter++).padStart(4, '0')}`;
}

async function enrollStudent(agent, classId, overrides = {}) {
  const payload = {
    classId,
    admissionNumber: nextAdmission(),
    firstName: 'Student',
    lastName: `No${admissionCounter}`,
    gender: 'male',
    ...overrides,
  };
  const res = await agent.post('/api/v1/students').send(payload);
  return res.body.student;
}

async function createTeacher(agent, emailPrefix = 'teacher') {
  const res = await agent.post('/api/v1/users').send({
    firstName: 'Grace',
    lastName: 'Mutiso',
    email: `${emailPrefix}-${Date.now()}@school.ke`,
    role: 'teacher',
    password: 'TempPass123!',
  });
  return res.body.user;
}

describe('POST /api/v1/attendance/registers', () => {
  it('creates a draft attendance register for a class and date', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-05',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.register.status).toBe('draft');
    expect(res.body.register.classId._id).toBe(cls._id);
    expect(res.body.register.academicYear).toBe('2025');
    expect(res.body.register.term).toBe('Term 1');
  });

  it('rejects duplicate register for same class/date', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-05',
    });

    const res = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-05',
    });

    expect(res.status).toBe(409);
  });

  it('accepts substitute teacher metadata', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const substitute = await createTeacher(agent);

    const res = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-06',
      substituteTeacherId: substitute._id,
      substituteNote: 'Class teacher is on leave.',
    });

    expect(res.status).toBe(201);
    expect(res.body.register.isSubstitute).toBe(true);
    expect(res.body.register.substituteTeacherId._id).toBe(substitute._id);
    expect(res.body.register.takenByUserId._id).toBe(substitute._id);
  });

  it('returns 404 when class belongs to another school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    const res = await agentB.post('/api/v1/attendance/registers').send({
      classId: clsA._id,
      date: '2025-05-05',
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/attendance/registers/:id and submit', () => {
  it('updates entries while register is draft', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const studentA = await enrollStudent(agent, cls._id, { firstName: 'Anna' });
    const studentB = await enrollStudent(agent, cls._id, { firstName: 'Brian' });

    const createRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-07',
    });
    const registerId = createRes.body.register._id;

    const patchRes = await agent.patch(`/api/v1/attendance/registers/${registerId}`).send({
      entries: [
        { studentId: studentA._id, status: 'present' },
        { studentId: studentB._id, status: 'late', note: 'Arrived after assembly' },
      ],
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.register.entries.length).toBe(2);
    expect(patchRes.body.register.entries[1].status).toBe('late');
  });

  it('rejects entries for students outside the target class', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls1 = await createClass(agent, { name: 'Grade 4' });
    const cls2 = await createClass(agent, { name: 'Grade 5' });
    const wrongStudent = await enrollStudent(agent, cls2._id);

    const createRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls1._id,
      date: '2025-05-08',
    });
    const registerId = createRes.body.register._id;

    const patchRes = await agent.patch(`/api/v1/attendance/registers/${registerId}`).send({
      entries: [{ studentId: wrongStudent._id, status: 'present' }],
    });

    expect(patchRes.status).toBe(400);
    expect(patchRes.body.message).toMatch(/not in the selected class/i);
  });

  it('submits a draft and blocks further edits', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const createRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-09',
      entries: [{ studentId: student._id, status: 'present' }],
    });
    const registerId = createRes.body.register._id;

    const submitRes = await agent.post(`/api/v1/attendance/registers/${registerId}/submit`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.register.status).toBe('submitted');
    expect(submitRes.body.register.submittedAt).toBeDefined();

    const patchAfterSubmit = await agent.patch(`/api/v1/attendance/registers/${registerId}`).send({
      entries: [{ studentId: student._id, status: 'absent' }],
    });
    expect(patchAfterSubmit.status).toBe(409);
  });

  it('rejects submit when register has no entries', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const createRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-12',
    });
    const registerId = createRes.body.register._id;

    const submitRes = await agent.post(`/api/v1/attendance/registers/${registerId}/submit`);

    expect(submitRes.status).toBe(400);
    expect(submitRes.body.message).toMatch(/no student entries/i);
  });
});

describe('GET /api/v1/attendance/registers and /:id', () => {
  it('lists registers with status filter', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const draftRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-13',
    });

    const submittedRes = await agent.post('/api/v1/attendance/registers').send({
      classId: cls._id,
      date: '2025-05-14',
      entries: [{ studentId: student._id, status: 'present' }],
    });
    await agent.post(`/api/v1/attendance/registers/${submittedRes.body.register._id}/submit`);

    const listSubmitted = await agent.get('/api/v1/attendance/registers?status=submitted');
    expect(listSubmitted.status).toBe(200);
    expect(listSubmitted.body.registers.length).toBe(1);
    expect(listSubmitted.body.registers[0].status).toBe('submitted');

    const listDraft = await agent.get('/api/v1/attendance/registers?status=draft');
    expect(listDraft.status).toBe(200);
    expect(listDraft.body.registers.length).toBe(1);
    expect(listDraft.body.registers[0]._id).toBe(draftRes.body.register._id);
  });

  it('enforces tenant isolation on list and get-by-id', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    const createRes = await agentA.post('/api/v1/attendance/registers').send({
      classId: clsA._id,
      date: '2025-05-13',
    });
    const registerId = createRes.body.register._id;

    const listB = await agentB.get('/api/v1/attendance/registers');
    expect(listB.status).toBe(200);
    expect(listB.body.registers.length).toBe(0);

    const getB = await agentB.get(`/api/v1/attendance/registers/${registerId}`);
    expect(getB.status).toBe(404);
  });
});
