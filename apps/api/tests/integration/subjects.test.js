import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

const schoolA = {
  schoolName: 'Peak Academy',
  schoolEmail: 'admin@peak.sc.ke',
  schoolPhone: '0713000001',
  county: 'Nairobi',
  firstName: 'Faith',
  lastName: 'Achieng',
  email: 'faith@peak.sc.ke',
  phone: '0713000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'River School',
  schoolEmail: 'admin@river.sc.ke',
  schoolPhone: '0713000002',
  county: 'Kisumu',
  firstName: 'Ken',
  lastName: 'Mutua',
  email: 'ken@river.sc.ke',
  phone: '0713000002',
  password: 'SecurePass1!',
};

const defaultClassPayload = {
  name: 'Grade 6',
  levelCategory: 'Upper Primary',
  academicYear: '2025',
  term: 'Term 1',
};

async function registerAndLogin(schoolData) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send(schoolData);
  return agent;
}

async function createClass(agent, overrides = {}) {
  const res = await agent.post('/api/v1/classes').send({ ...defaultClassPayload, ...overrides });
  return res.body.class;
}

async function createSubject(agent, overrides = {}) {
  const classObj = overrides.classObj || (await createClass(agent));
  const payload = {
    classId: classObj._id,
    name: 'Mathematics',
    code: 'MATH',
    ...overrides,
  };
  delete payload.classObj;
  const res = await agent.post('/api/v1/subjects').send(payload);
  return { res, payload };
}

describe('POST /api/v1/subjects', () => {
  it('creates a subject for a class', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/subjects').send({
      classId: cls._id,
      name: 'Mathematics',
      code: 'MATH',
    });

    expect(res.status).toBe(201);
    expect(res.body.subject.name).toBe('Mathematics');
    expect(res.body.subject.code).toBe('MATH');
  });

  it('rejects duplicate subject name in same class', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);

    await agent.post('/api/v1/subjects').send({ classId: cls._id, name: 'English' });
    const res = await agent.post('/api/v1/subjects').send({ classId: cls._id, name: 'English' });

    expect(res.status).toBe(409);
  });

  it('allows same subject name in different classes', async () => {
    const agent = await registerAndLogin(schoolA);
    const classA = await createClass(agent, { name: 'Grade 6' });
    const classB = await createClass(agent, { name: 'Grade 7', levelCategory: 'Junior Secondary' });

    const r1 = await agent.post('/api/v1/subjects').send({ classId: classA._id, name: 'Science' });
    const r2 = await agent.post('/api/v1/subjects').send({ classId: classB._id, name: 'Science' });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it('blocks subjects for Pre-Primary classes', async () => {
    const agent = await registerAndLogin(schoolA);
    const prePrimaryClass = await createClass(agent, {
      name: 'PP1',
      levelCategory: 'Pre-Primary',
    });

    const res = await agent.post('/api/v1/subjects').send({
      classId: prePrimaryClass._id,
      name: 'Literacy',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pre-primary classes cannot have subjects/i);
  });
});

describe('GET /api/v1/subjects', () => {
  it('lists subjects for the school with pagination metadata', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    await createSubject(agent, { classObj: cls, name: 'Mathematics' });
    await createSubject(agent, { classObj: cls, name: 'English' });

    const res = await agent.get('/api/v1/subjects');

    expect(res.status).toBe(200);
    expect(res.body.subjects.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by classId', async () => {
    const agent = await registerAndLogin(schoolA);
    const classA = await createClass(agent, { name: 'Grade 6' });
    const classB = await createClass(agent, { name: 'Grade 7', levelCategory: 'Junior Secondary' });

    await createSubject(agent, { classObj: classA, name: 'Mathematics' });
    await createSubject(agent, { classObj: classB, name: 'Biology' });

    const res = await agent.get(`/api/v1/subjects?classId=${classA._id}`);

    expect(res.status).toBe(200);
    expect(res.body.subjects.length).toBe(1);
    expect(res.body.subjects[0].classId._id).toBe(classA._id);
  });

  it('enforces tenant isolation on list endpoint', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    await createSubject(agentA, { name: 'Kiswahili' });

    const res = await agentB.get('/api/v1/subjects');

    expect(res.status).toBe(200);
    expect(res.body.subjects.length).toBe(0);
  });
});

describe('GET /api/v1/subjects/:id', () => {
  it('returns a single subject', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createSubject(agent, { name: 'History' });
    const subjectId = createRes.body.subject._id;

    const res = await agent.get(`/api/v1/subjects/${subjectId}`);

    expect(res.status).toBe(200);
    expect(res.body.subject._id).toBe(subjectId);
  });

  it('returns 404 for subject in another school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const { res: createRes } = await createSubject(agentA, { name: 'CRE' });
    const subjectId = createRes.body.subject._id;

    const res = await agentB.get(`/api/v1/subjects/${subjectId}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/subjects/:id', () => {
  it('updates subject name and code', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createSubject(agent, { name: 'Physics', code: 'PHY' });
    const subjectId = createRes.body.subject._id;

    const res = await agent.patch(`/api/v1/subjects/${subjectId}`).send({
      name: 'Advanced Physics',
      code: 'advphy',
    });

    expect(res.status).toBe(200);
    expect(res.body.subject.name).toBe('Advanced Physics');
    expect(res.body.subject.code).toBe('ADVPHY');
  });

  it('rejects moving subject to a Pre-Primary class', async () => {
    const agent = await registerAndLogin(schoolA);
    const regularClass = await createClass(agent, { name: 'Grade 3', levelCategory: 'Lower Primary' });
    const prePrimaryClass = await createClass(agent, { name: 'PP2', levelCategory: 'Pre-Primary' });
    const createRes = await agent.post('/api/v1/subjects').send({
      classId: regularClass._id,
      name: 'Environmental Activities',
    });
    const subjectId = createRes.body.subject._id;

    const res = await agent.patch(`/api/v1/subjects/${subjectId}`).send({
      classId: prePrimaryClass._id,
    });

    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (.strict())', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createSubject(agent, { name: 'Music' });
    const subjectId = createRes.body.subject._id;

    const res = await agent.patch(`/api/v1/subjects/${subjectId}`).send({ badField: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for cross-school update', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const { res: createRes } = await createSubject(agentA, { name: 'French' });
    const subjectId = createRes.body.subject._id;

    const res = await agentB.patch(`/api/v1/subjects/${subjectId}`).send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/subjects/:id', () => {
  it('deletes subject', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createSubject(agent, { name: 'Art' });
    const subjectId = createRes.body.subject._id;

    const res = await agent.delete(`/api/v1/subjects/${subjectId}`);
    expect(res.status).toBe(200);

    const getRes = await agent.get(`/api/v1/subjects/${subjectId}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for cross-school delete', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const { res: createRes } = await createSubject(agentA, { name: 'Geography' });
    const subjectId = createRes.body.subject._id;

    const res = await agentB.delete(`/api/v1/subjects/${subjectId}`);
    expect(res.status).toBe(404);
  });
});
