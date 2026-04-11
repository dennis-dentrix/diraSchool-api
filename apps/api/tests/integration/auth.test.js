import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Test data ─────────────────────────────────────────────────────────────────

const validRegistration = {
  schoolName: 'Greenfield Academy',
  schoolEmail: 'admin@greenfield.sc.ke',
  schoolPhone: '0712345678',
  county: 'Nairobi',
  firstName: 'Jane',
  lastName: 'Wanjiku',
  email: 'jane@greenfield.sc.ke',
  phone: '0712345678',
  password: 'SecurePass1!',
};

// ── Registration ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('creates school + admin user and returns JWT cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.user.email).toBe('jane@greenfield.sc.ke');
    expect(res.body.user.role).toBe('school_admin');
    expect(res.body.user.password).toBeUndefined(); // never exposed
    expect(res.body.school.name).toBe('Greenfield Academy');
    expect(res.body.school.subscriptionStatus).toBe('trial');
    // JWT cookie must be set
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('rejects duplicate school email', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'other@greenfield.sc.ke' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBeDefined();
  });

  it('allows same admin email in a different school (per-school uniqueness)', async () => {
    // Per spec: email uniqueness is compound {schoolId + email}, not global.
    // The same person can be admin at two different schools.
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, schoolEmail: 'other@other.sc.ke' });

    // Different school → same admin email is allowed
    expect(res.status).toBe(201);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ schoolName: 'Test' });

    expect(res.status).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);
  });

  it('returns JWT cookie on valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: validRegistration.email,
      password: 'WrongPassword1!',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@nowhere.com',
      password: 'AnyPassword1!',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects missing password field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email });

    expect(res.status).toBe(400);
  });
});

// ── Get current user ──────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const agent = request.agent(app); // agent preserves cookies between requests

    await agent.post('/api/v1/auth/register').send(validRegistration);

    const res = await agent.get('/api/v1/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegistration.email);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when cookie is tampered', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'token=invalid.tampered.token');

    expect(res.status).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('clears the token cookie', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/register').send(validRegistration);

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    // Should now be unauthenticated
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });
});

// ── Change password ───────────────────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  it('changes password and clears mustChangePassword', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(validRegistration);

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: validRegistration.password,
      newPassword: 'NewSecurePass2!',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password changed/i);

    // Can now log in with new password
    const login = await request(app).post('/api/v1/auth/login').send({
      email: validRegistration.email,
      password: 'NewSecurePass2!',
    });
    expect(login.status).toBe(200);
  });

  it('rejects wrong current password', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(validRegistration);

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: 'WrongOldPassword!',
      newPassword: 'NewSecurePass2!',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it('rejects new password under 8 characters', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(validRegistration);

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: validRegistration.password,
      newPassword: 'short',
    });

    expect(res.status).toBe(400);
  });

  it('blocks unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/auth/change-password').send({
      currentPassword: 'anything',
      newPassword: 'NewSecurePass2!',
    });
    expect(res.status).toBe(401);
  });
});

// ── mustChangePassword enforcement ───────────────────────────────────────────

describe('mustChangePassword enforcement', () => {
  it('blocks /me when mustChangePassword is true', async () => {
    // Manually create a user with mustChangePassword = true
    const { default: User } = await import('../../src/features/users/User.model.js');
    const { default: School } = await import('../../src/features/schools/School.model.js');

    const school = await School.create({
      name: 'Test School',
      email: 'test@school.ke',
      phone: '+254712000001',
    });

    await User.create({
      firstName: 'Staff',
      lastName: 'Member',
      email: 'staff@school.ke',
      password: 'TempPass123!',
      role: 'teacher',
      schoolId: school._id,
      mustChangePassword: true,
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email: 'staff@school.ke',
      password: 'TempPass123!',
    });

    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(403);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('allows change-password even when mustChangePassword is true', async () => {
    const { default: User } = await import('../../src/features/users/User.model.js');
    const { default: School } = await import('../../src/features/schools/School.model.js');

    const school = await School.create({
      name: 'Test School 2',
      email: 'test2@school.ke',
      phone: '+254712000002',
    });

    await User.create({
      firstName: 'Staff',
      lastName: 'Member',
      email: 'staff2@school.ke',
      password: 'TempPass123!',
      role: 'teacher',
      schoolId: school._id,
      mustChangePassword: true,
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email: 'staff2@school.ke',
      password: 'TempPass123!',
    });

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: 'TempPass123!',
      newPassword: 'NewPassword456!',
    });

    expect(res.status).toBe(200);
  });
});
