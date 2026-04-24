import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';
import { registerAndLogin } from './helpers.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Helpers ───────────────────────────────────────────────────────────────────

const schoolA = {
  schoolName: 'Highland Academy',
  schoolEmail: 'admin@highland.sc.ke',
  schoolPhone: '0720000001',
  county: 'Nakuru',
  firstName: 'Mary',
  lastName: 'Wambui',
  email: 'mary@highland.sc.ke',
  phone: '0720000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Coastal School',
  schoolEmail: 'admin@coastal.sc.ke',
  schoolPhone: '0720000002',
  county: 'Mombasa',
  firstName: 'Ali',
  lastName: 'Hassan',
  email: 'ali@coastal.sc.ke',
  phone: '0720000002',
  password: 'SecurePass1!',
};

const classPayload = {
  name: 'Grade 3',
  levelCategory: 'Lower Primary',
  academicYear: '2025',
  term: 'Term 1',
};

async function createClass(agent, overrides = {}) {
  const res = await agent.post('/api/v1/classes').send({ ...classPayload, ...overrides });
  return res.body.class;
}

let adCounter = 1;
function nextAdmission() {
  return `ADM${String(adCounter++).padStart(4, '0')}`;
}

async function enrollStudent(agent, classId, overrides = {}) {
  const payload = {
    classId,
    admissionNumber: nextAdmission(),
    firstName: 'James',
    lastName: 'Kariuki',
    gender: 'male',
    ...overrides,
  };
  const res = await agent.post('/api/v1/students').send(payload);
  return { res, payload };
}

// ── POST /api/v1/students ─────────────────────────────────────────────────────

describe('POST /api/v1/students', () => {
  it('enrolls a student in a class', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const { res } = await enrollStudent(agent, cls._id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.student.firstName).toBe('James');
    expect(res.body.student.classId._id).toBe(cls._id);
  });

  it('upper-cases admission number', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/students').send({
      classId: cls._id,
      admissionNumber: 'adm001',
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'female',
    });

    expect(res.status).toBe(201);
    expect(res.body.student.admissionNumber).toBe('ADM001');
  });

  it('increments class studentCount on enroll', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    await enrollStudent(agent, cls._id);
    await enrollStudent(agent, cls._id);

    const clsRes = await agent.get(`/api/v1/classes/${cls._id}`);
    expect(clsRes.body.class.studentCount).toBe(2);
  });

  it('auto-creates a parent user when parent data is supplied', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/students').send({
      classId: cls._id,
      admissionNumber: nextAdmission(),
      firstName: 'Tom',
      lastName: 'Njoki',
      gender: 'male',
      parent: {
        firstName: 'Diana',
        lastName: 'Njoki',
        phone: '0734000001',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.student.parentIds.length).toBe(1);
    expect(res.body.student.parentIds[0].firstName).toBe('Diana');

    // Verify parent user was created with role=parent
    const usersRes = await agent.get('/api/v1/users?role=parent');
    expect(usersRes.body.users.some((u) => u.firstName === 'Diana')).toBe(true);
  });

  it('links parent to student in parent.children array', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/students').send({
      classId: cls._id,
      admissionNumber: nextAdmission(),
      firstName: 'Sara',
      lastName: 'Maina',
      gender: 'female',
      parent: { firstName: 'Ruth', lastName: 'Maina', phone: '0734000002' },
    });

    expect(res.status).toBe(201);
    const parentId = res.body.student.parentIds[0]._id;
    const studentId = res.body.student._id;

    // Verify via the user endpoint
    const userRes = await agent.get(`/api/v1/users/${parentId}`);
    expect(userRes.body.user.children).toContain(studentId);
  });

  it('rejects duplicate admission number in same school', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const admissionNumber = 'ADM9999';

    await enrollStudent(agent, cls._id, { admissionNumber });
    const { res } = await enrollStudent(agent, cls._id, { admissionNumber });

    expect(res.status).toBe(409);
  });

  it('allows same admission number in different schools', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);
    const clsB = await createClass(agentB);
    const admissionNumber = 'SHARED001';

    const r1 = await agentA.post('/api/v1/students').send({
      classId: clsA._id, admissionNumber, firstName: 'A', lastName: 'B', gender: 'male',
    });
    const r2 = await agentB.post('/api/v1/students').send({
      classId: clsB._id, admissionNumber, firstName: 'A', lastName: 'B', gender: 'male',
    });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it('returns 404 when classId belongs to another school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    const { res } = await enrollStudent(agentB, clsA._id);
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/students').send({
      classId: '000000000000000000000001', admissionNumber: 'X', firstName: 'X', lastName: 'X', gender: 'male',
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/students ──────────────────────────────────────────────────────

describe('GET /api/v1/students', () => {
  it('returns paginated students for the school', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    await enrollStudent(agent, cls._id);
    await enrollStudent(agent, cls._id);

    const res = await agent.get('/api/v1/students');

    expect(res.status).toBe(200);
    expect(res.body.students.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by classId', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls1 = await createClass(agent);
    const cls2 = await createClass(agent, { name: 'Grade 4' });

    await enrollStudent(agent, cls1._id);
    await enrollStudent(agent, cls2._id);

    const res = await agent.get(`/api/v1/students?classId=${cls1._id}`);

    expect(res.status).toBe(200);
    expect(res.body.students.length).toBe(1);
    expect(res.body.students[0].classId._id).toBe(cls1._id);
  });

  it('searches by name', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    await enrollStudent(agent, cls._id, { firstName: 'Zebra', lastName: 'Zulu' });
    await enrollStudent(agent, cls._id, { firstName: 'Alpha', lastName: 'Beta' });

    const res = await agent.get('/api/v1/students?search=Zebra');

    expect(res.status).toBe(200);
    expect(res.body.students.length).toBe(1);
    expect(res.body.students[0].firstName).toBe('Zebra');
  });

  it('does not return students from another school (tenant isolation)', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    await enrollStudent(agentA, clsA._id);

    const res = await agentB.get('/api/v1/students');

    expect(res.status).toBe(200);
    expect(res.body.students.length).toBe(0);
  });
});

// ── GET /api/v1/students/:id ──────────────────────────────────────────────────

describe('GET /api/v1/students/:id', () => {
  it('returns a single student', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.get(`/api/v1/students/${studentId}`);

    expect(res.status).toBe(200);
    expect(res.body.student._id).toBe(studentId);
    expect(res.body.student.classId.name).toBe('Grade 3');
  });

  it('returns 404 for student in different school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const cls = await createClass(agentA);
    const { res: enrollRes } = await enrollStudent(agentA, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agentB.get(`/api/v1/students/${studentId}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/v1/students/:id ────────────────────────────────────────────────

describe('PATCH /api/v1/students/:id', () => {
  it('updates student details', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.patch(`/api/v1/students/${studentId}`).send({
      firstName: 'Updated',
      gender: 'female',
    });

    expect(res.status).toBe(200);
    expect(res.body.student.firstName).toBe('Updated');
    expect(res.body.student.gender).toBe('female');
  });

  it('does NOT increment studentCount on update', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    await agent.patch(`/api/v1/students/${studentId}`).send({ firstName: 'Updated2' });

    const clsRes = await agent.get(`/api/v1/classes/${cls._id}`);
    expect(clsRes.body.class.studentCount).toBe(1); // still 1, not 2
  });

  it('rejects unknown fields (.strict())', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.patch(`/api/v1/students/${studentId}`).send({ schoolId: 'hijack' });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/students/:id/transfer ───────────────────────────────────────

describe('POST /api/v1/students/:id/transfer', () => {
  it('moves student to a new class and adjusts counts', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls1 = await createClass(agent);
    const cls2 = await createClass(agent, { name: 'Grade 4' });

    const { res: enrollRes } = await enrollStudent(agent, cls1._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.post(`/api/v1/students/${studentId}/transfer`).send({
      newClassId: cls2._id,
    });

    expect(res.status).toBe(200);
    expect(res.body.student.classId).toBe(cls2._id);

    const cls1Res = await agent.get(`/api/v1/classes/${cls1._id}`);
    const cls2Res = await agent.get(`/api/v1/classes/${cls2._id}`);
    expect(cls1Res.body.class.studentCount).toBe(0);
    expect(cls2Res.body.class.studentCount).toBe(1);
  });

  it('returns 400 when student is already in target class', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.post(`/api/v1/students/${studentId}/transfer`).send({
      newClassId: cls._id,
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for target class in different school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);
    const clsB = await createClass(agentB);

    const { res: enrollRes } = await enrollStudent(agentA, clsA._id);
    const studentId = enrollRes.body.student._id;

    const res = await agentA.post(`/api/v1/students/${studentId}/transfer`).send({
      newClassId: clsB._id,
    });
    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/students/:id/withdraw ───────────────────────────────────────

describe('POST /api/v1/students/:id/withdraw', () => {
  it('marks student as withdrawn', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    const res = await agent.post(`/api/v1/students/${studentId}/withdraw`);

    expect(res.status).toBe(200);
    expect(res.body.student.status).toBe('withdrawn');
  });

  it('decrements class studentCount on withdraw', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    await agent.post(`/api/v1/students/${studentId}/withdraw`);

    const clsRes = await agent.get(`/api/v1/classes/${cls._id}`);
    expect(clsRes.body.class.studentCount).toBe(0);
  });

  it('cannot withdraw an already-withdrawn student', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const { res: enrollRes } = await enrollStudent(agent, cls._id);
    const studentId = enrollRes.body.student._id;

    await agent.post(`/api/v1/students/${studentId}/withdraw`);
    const res = await agent.post(`/api/v1/students/${studentId}/withdraw`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  it('blocks deleting a class with students', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    await enrollStudent(agent, cls._id);

    const res = await agent.delete(`/api/v1/classes/${cls._id}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/enrolled/i);
  });
});
