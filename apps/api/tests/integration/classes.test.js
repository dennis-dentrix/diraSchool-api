import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Helpers ───────────────────────────────────────────────────────────────────

const schoolA = {
  schoolName: 'Sunrise Primary',
  schoolEmail: 'admin@sunrise.sc.ke',
  schoolPhone: '0711000001',
  county: 'Nairobi',
  firstName: 'Grace',
  lastName: 'Njeri',
  email: 'grace@sunrise.sc.ke',
  phone: '0711000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Westside School',
  schoolEmail: 'admin@westside.sc.ke',
  schoolPhone: '0711000002',
  county: 'Mombasa',
  firstName: 'Peter',
  lastName: 'Otieno',
  email: 'peter@westside.sc.ke',
  phone: '0711000002',
  password: 'SecurePass1!',
};

async function registerAndLogin(schoolData) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send(schoolData);
  return agent;
}

const validClass = {
  name: 'Grade 4',
  levelCategory: 'Upper Primary',
  academicYear: '2025',
  term: 'Term 1',
};

// ── POST /api/v1/classes ──────────────────────────────────────────────────────

describe('POST /api/v1/classes', () => {
  it('creates a class scoped to the school', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.post('/api/v1/classes').send(validClass);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.class.name).toBe('Grade 4');
    expect(res.body.class.levelCategory).toBe('Upper Primary');
    expect(res.body.class.studentCount).toBe(0);
  });

  it('creates class with stream', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.post('/api/v1/classes').send({ ...validClass, stream: 'North' });

    expect(res.status).toBe(201);
    expect(res.body.class.stream).toBe('North');
  });

  it('rejects duplicate class (same name + stream + year + term)', async () => {
    const agent = await registerAndLogin(schoolA);
    await agent.post('/api/v1/classes').send(validClass);
    const res = await agent.post('/api/v1/classes').send(validClass);

    expect(res.status).toBe(409);
  });

  it('allows same class name in different schools', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const r1 = await agentA.post('/api/v1/classes').send(validClass);
    const r2 = await agentB.post('/api/v1/classes').send(validClass);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it('rejects invalid level category', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.post('/api/v1/classes').send({ ...validClass, levelCategory: 'Made Up' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid term', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.post('/api/v1/classes').send({ ...validClass, term: 'Term 4' });

    expect(res.status).toBe(400);
  });

  it('rejects non-4-digit academic year', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.post('/api/v1/classes').send({ ...validClass, academicYear: '25' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/classes').send(validClass);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/classes ───────────────────────────────────────────────────────

describe('GET /api/v1/classes', () => {
  it('returns classes for the school', async () => {
    const agent = await registerAndLogin(schoolA);
    await agent.post('/api/v1/classes').send(validClass);
    await agent.post('/api/v1/classes').send({ ...validClass, name: 'Grade 5' });

    const res = await agent.get('/api/v1/classes');

    expect(res.status).toBe(200);
    expect(res.body.classes.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by academicYear', async () => {
    const agent = await registerAndLogin(schoolA);
    await agent.post('/api/v1/classes').send(validClass);
    await agent.post('/api/v1/classes').send({ ...validClass, name: 'Grade 5', academicYear: '2024' });

    const res = await agent.get('/api/v1/classes?academicYear=2025');

    expect(res.status).toBe(200);
    expect(res.body.classes.every((c) => c.academicYear === '2025')).toBe(true);
  });

  it('filters by term', async () => {
    const agent = await registerAndLogin(schoolA);
    await agent.post('/api/v1/classes').send(validClass);
    await agent.post('/api/v1/classes').send({ ...validClass, name: 'Grade 5', term: 'Term 2' });

    const res = await agent.get('/api/v1/classes?term=Term 1');

    expect(res.status).toBe(200);
    expect(res.body.classes.every((c) => c.term === 'Term 1')).toBe(true);
  });

  it('does not return classes from another school (tenant isolation)', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    await agentA.post('/api/v1/classes').send(validClass);

    const res = await agentB.get('/api/v1/classes');

    expect(res.status).toBe(200);
    expect(res.body.classes.length).toBe(0);
  });
});

// ── GET /api/v1/classes/:id ───────────────────────────────────────────────────

describe('GET /api/v1/classes/:id', () => {
  it('returns class by id', async () => {
    const agent = await registerAndLogin(schoolA);
    const createRes = await agent.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agent.get(`/api/v1/classes/${classId}`);

    expect(res.status).toBe(200);
    expect(res.body.class._id).toBe(classId);
  });

  it('returns 404 for class in different school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const createRes = await agentA.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agentB.get(`/api/v1/classes/${classId}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/v1/classes/:id ─────────────────────────────────────────────────

describe('PATCH /api/v1/classes/:id', () => {
  it('updates class name', async () => {
    const agent = await registerAndLogin(schoolA);
    const createRes = await agent.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agent.patch(`/api/v1/classes/${classId}`).send({ name: 'Grade 4 Updated' });

    expect(res.status).toBe(200);
    expect(res.body.class.name).toBe('Grade 4 Updated');
  });

  it('rejects unknown fields (.strict())', async () => {
    const agent = await registerAndLogin(schoolA);
    const createRes = await agent.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agent.patch(`/api/v1/classes/${classId}`).send({ unknownField: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for class in different school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const createRes = await agentA.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agentB.patch(`/api/v1/classes/${classId}`).send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/classes/:id ────────────────────────────────────────────────

describe('DELETE /api/v1/classes/:id', () => {
  it('deletes an empty class', async () => {
    const agent = await registerAndLogin(schoolA);
    const createRes = await agent.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agent.delete(`/api/v1/classes/${classId}`);
    expect(res.status).toBe(200);

    const getRes = await agent.get(`/api/v1/classes/${classId}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for class in different school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const createRes = await agentA.post('/api/v1/classes').send(validClass);
    const classId = createRes.body.class._id;

    const res = await agentB.delete(`/api/v1/classes/${classId}`);
    expect(res.status).toBe(404);
  });
});
