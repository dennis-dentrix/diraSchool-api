import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Helpers ───────────────────────────────────────────────────────────────────

const schoolA = {
  schoolName: 'Riverside Academy',
  schoolEmail: 'admin@riverside.sc.ke',
  schoolPhone: '0712000001',
  county: 'Nairobi',
  firstName: 'Alice',
  lastName: 'Kamau',
  email: 'alice@riverside.sc.ke',
  phone: '0712000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Lakeside School',
  schoolEmail: 'admin@lakeside.sc.ke',
  schoolPhone: '0712000002',
  county: 'Kisumu',
  firstName: 'Bob',
  lastName: 'Ochieng',
  email: 'bob@lakeside.sc.ke',
  phone: '0712000002',
  password: 'SecurePass1!',
};

/** Register a school and return an authenticated supertest agent */
async function registerAndLogin(schoolData) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send(schoolData);
  return agent;
}

/** Create a staff user via the API and return the created user object */
async function createStaff(agent, overrides = {}) {
  const payload = {
    firstName: 'John',
    lastName: 'Mwangi',
    email: `staff${Date.now()}@school.ke`,
    phone: '0712345678',
    role: 'teacher',
    password: 'TempPass123!',
    ...overrides,
  };
  const res = await agent.post('/api/v1/users').send(payload);
  return { res, payload };
}

// ── POST /api/v1/users ────────────────────────────────────────────────────────

describe('POST /api/v1/users', () => {
  it('creates a staff user scoped to the admin school', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res } = await createStaff(agent, { role: 'teacher' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.user.role).toBe('teacher');
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.password).toBeUndefined();
  });

  it('normalises Kenyan phone number', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res } = await createStaff(agent, { phone: '0712345678' });

    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe('+254712345678');
  });

  it('rejects invalid role (school_admin not assignable)', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res } = await createStaff(agent, { role: 'school_admin' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate email within same school', async () => {
    const agent = await registerAndLogin(schoolA);
    const email = 'duplicate@riverside.sc.ke';

    await createStaff(agent, { email });
    const { res } = await createStaff(agent, { email });

    expect(res.status).toBe(409);
  });

  it('allows same email in different schools', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const email = 'shared@staff.ke';

    const r1 = await agentA.post('/api/v1/users').send({
      firstName: 'X', lastName: 'Y', email, role: 'teacher', password: 'TempPass123!',
    });
    const r2 = await agentB.post('/api/v1/users').send({
      firstName: 'X', lastName: 'Y', email, role: 'teacher', password: 'TempPass123!',
    });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/users').send({
      firstName: 'X', lastName: 'Y', email: 'x@y.ke', role: 'teacher', password: 'TempPass123!',
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/users ─────────────────────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('returns paginated list of users in the school', async () => {
    const agent = await registerAndLogin(schoolA);
    await createStaff(agent, { role: 'teacher' });
    await createStaff(agent, { role: 'accountant' });

    const res = await agent.get('/api/v1/users');

    expect(res.status).toBe(200);
    // Includes the school_admin itself + 2 created staff
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.users[0].password).toBeUndefined();
  });

  it('filters by role', async () => {
    const agent = await registerAndLogin(schoolA);
    await createStaff(agent, { role: 'teacher' });
    await createStaff(agent, { role: 'accountant' });

    const res = await agent.get('/api/v1/users?role=teacher');

    expect(res.status).toBe(200);
    expect(res.body.users.every((u) => u.role === 'teacher')).toBe(true);
  });

  it('does not return users from another school (tenant isolation)', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    await createStaff(agentA, { role: 'teacher' });

    const res = await agentB.get('/api/v1/users');

    expect(res.status).toBe(200);
    // School B should only see its own admin
    expect(res.body.users.every((u) => u.email !== 'alice@riverside.sc.ke')).toBe(true);
  });

  it('paginates correctly', async () => {
    const agent = await registerAndLogin(schoolA);
    // Create 5 staff
    for (let i = 0; i < 5; i++) {
      await createStaff(agent, { role: 'teacher' });
    }

    const res = await agent.get('/api/v1/users?page=1&limit=3');

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(3);
    expect(res.body.meta.limit).toBe(3);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(2);
  });
});

// ── GET /api/v1/users/:id ─────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('returns a single user in the same school', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createStaff(agent);
    const userId = createRes.body.user._id;

    const res = await agent.get(`/api/v1/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(userId);
  });

  it('returns 404 for user in a different school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const { res: createRes } = await createStaff(agentA);
    const userId = createRes.body.user._id;

    // School B tries to access School A's user
    const res = await agentB.get(`/api/v1/users/${userId}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent id', async () => {
    const agent = await registerAndLogin(schoolA);
    const res = await agent.get('/api/v1/users/000000000000000000000001');
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/v1/users/:id ───────────────────────────────────────────────────

describe('PATCH /api/v1/users/:id', () => {
  it('updates name and role', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createStaff(agent, { role: 'teacher' });
    const userId = createRes.body.user._id;

    const res = await agent.patch(`/api/v1/users/${userId}`).send({
      firstName: 'Updated',
      role: 'secretary',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Updated');
    expect(res.body.user.role).toBe('secretary');
  });

  it('deactivates a user', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createStaff(agent);
    const userId = createRes.body.user._id;

    const res = await agent.patch(`/api/v1/users/${userId}`).send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('rejects editing own account via this endpoint', async () => {
    const agent = await registerAndLogin(schoolA);
    // Get own user id from /me
    const me = await agent.get('/api/v1/auth/me');
    const myId = me.body.user._id;

    const res = await agent.patch(`/api/v1/users/${myId}`).send({ firstName: 'Self' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/change-password/i);
  });

  it('rejects cross-school update (tenant isolation)', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const { res: createRes } = await createStaff(agentA);
    const userId = createRes.body.user._id;

    const res = await agentB.patch(`/api/v1/users/${userId}`).send({ firstName: 'Hacked' });
    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/users/:id/reset-password ─────────────────────────────────────

describe('POST /api/v1/users/:id/reset-password', () => {
  it('resets password and sets mustChangePassword', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes } = await createStaff(agent);
    const userId = createRes.body.user._id;

    const res = await agent.post(`/api/v1/users/${userId}/reset-password`);

    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeDefined();
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(12);
  });

  it('user can login with the new temp password', async () => {
    const agent = await registerAndLogin(schoolA);
    const { res: createRes, payload } = await createStaff(agent);
    const userId = createRes.body.user._id;

    const resetRes = await agent.post(`/api/v1/users/${userId}/reset-password`);
    const { tempPassword } = resetRes.body;

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: payload.email,
      password: tempPassword,
    });

    expect(loginRes.status).toBe(200);
  });

  it('returns 400 when trying to reset own password', async () => {
    const agent = await registerAndLogin(schoolA);
    const me = await agent.get('/api/v1/auth/me');
    const myId = me.body.user._id;

    const res = await agent.post(`/api/v1/users/${myId}/reset-password`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for user in different school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);

    const { res: createRes } = await createStaff(agentA);
    const userId = createRes.body.user._id;

    const res = await agentB.post(`/api/v1/users/${userId}/reset-password`);
    expect(res.status).toBe(404);
  });
});
