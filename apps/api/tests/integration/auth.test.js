import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';
import User from '../../src/features/users/User.model.js';
import School from '../../src/features/schools/School.model.js';

// Mock BullMQ queues — prevents Redis connection attempts in tests
vi.mock('../../src/jobs/queues.js', () => ({
  smsQueue:     { add: vi.fn().mockResolvedValue({ id: 'mock-sms' }) },
  reportQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-report' }) },
  receiptQueue: { add: vi.fn().mockResolvedValue({ id: 'mock-receipt' }) },
  importQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-import' }) },
  emailQueue:   { add: vi.fn().mockResolvedValue({ id: 'mock-email' }) },
}));

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Test data ─────────────────────────────────────────────────────────────────

const validRegistration = {
  schoolName:  'Greenfield Academy',
  schoolEmail: 'admin@greenfield.sc.ke',
  schoolPhone: '0712345678',
  county:      'Nairobi',
  firstName:   'Jane',
  lastName:    'Wanjiku',
  email:       'jane@greenfield.sc.ke',
  phone:       '0712345678',
  password:    'SecurePass1!',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Write a known raw token into the DB so tests can call verify-email */
const getRawVerifyToken = async (email) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await User.updateOne(
    { email },
    {
      emailVerificationToken:  crypto.createHash('sha256').update(rawToken).digest('hex'),
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
  );
  return rawToken;
};

/** Register + verify in one step */
const registerAndVerify = async (overrides = {}) => {
  await request(app).post('/api/v1/auth/register').send({ ...validRegistration, ...overrides });
  const email = overrides.email ?? validRegistration.email;
  const rawToken = await getRawVerifyToken(email);
  await request(app).get(`/api/v1/auth/verify-email/${rawToken}`);
};

/** Register, verify, and return an authenticated cookie agent */
const registerVerifyAndLogin = async (overrides = {}) => {
  await registerAndVerify(overrides);
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({
    email:    overrides.email    ?? validRegistration.email,
    password: overrides.password ?? validRegistration.password,
  });
  return agent;
};

// ── Registration ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('creates school + admin and returns 201 with verification message (no cookie)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/verification/i);
    expect(res.body.email).toBe(validRegistration.email);
    expect(res.body.school.name).toBe(validRegistration.schoolName);
    // No cookie — user must verify email before logging in
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects duplicate school email', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, schoolName: 'Greenfield Two' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBeDefined();
  });

  it('allows a second school to register with a different email', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegistration,
        schoolName: 'Other Academy',
        email: 'other@otheracademy.sc.ke',
      });

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

// ── Email verification ────────────────────────────────────────────────────────

describe('GET /api/v1/auth/verify-email/:token', () => {
  it('verifies email, sets cookie, and returns user', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const rawToken = await getRawVerifyToken(validRegistration.email);

    const res = await request(app).get(`/api/v1/auth/verify-email/${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.message).toMatch(/verified/i);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('returns 400 for an invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/verify-email/totallywrongtoken');
    expect(res.status).toBe(400);
  });

  it('token is single-use — second call returns 400', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const rawToken = await getRawVerifyToken(validRegistration.email);

    await request(app).get(`/api/v1/auth/verify-email/${rawToken}`); // first use ✓
    const res = await request(app).get(`/api/v1/auth/verify-email/${rawToken}`); // reuse ✗

    expect(res.status).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns JWT cookie on valid credentials after email is verified', async () => {
    await registerAndVerify();

    const res = await request(app).post('/api/v1/auth/login').send({
      email:    validRegistration.email,
      password: validRegistration.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('returns 403 when email is not verified', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app).post('/api/v1/auth/login').send({
      email:    validRegistration.email,
      password: validRegistration.password,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it('rejects wrong password', async () => {
    await registerAndVerify();

    const res = await request(app).post('/api/v1/auth/login').send({
      email:    validRegistration.email,
      password: 'WrongPassword1!',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email:    'nobody@nowhere.com',
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
    const agent = await registerVerifyAndLogin();
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
    const agent = await registerVerifyAndLogin();

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });
});

// ── Change password ───────────────────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  it('changes password and allows login with new password', async () => {
    const agent = await registerVerifyAndLogin();

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: validRegistration.password,
      newPassword:     'NewSecurePass2!',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password changed/i);

    // New password works
    const loginNew = await request(app).post('/api/v1/auth/login').send({
      email:    validRegistration.email,
      password: 'NewSecurePass2!',
    });
    expect(loginNew.status).toBe(200);
  });

  it('rejects wrong current password', async () => {
    const agent = await registerVerifyAndLogin();

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: 'WrongOldPassword!',
      newPassword:     'NewSecurePass2!',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it('rejects new password under 8 characters', async () => {
    const agent = await registerVerifyAndLogin();

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: validRegistration.password,
      newPassword:     'short',
    });

    expect(res.status).toBe(400);
  });

  it('blocks unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/auth/change-password').send({
      currentPassword: 'anything',
      newPassword:     'NewSecurePass2!',
    });
    expect(res.status).toBe(401);
  });
});

// ── mustChangePassword enforcement ───────────────────────────────────────────

describe('mustChangePassword enforcement', () => {
  it('blocks /me when mustChangePassword is true', async () => {
    const school = await School.create({
      name:  'Test School',
      email: 'test@school.ke',
      phone: '+254712000001',
    });

    await User.create({
      firstName:          'Staff',
      lastName:           'Member',
      email:              'staff@school.ke',
      password:           'TempPass123!',
      role:               'teacher',
      schoolId:           school._id,
      mustChangePassword: true,
      emailVerified:      true,   // direct DB create — bypass verification
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email:    'staff@school.ke',
      password: 'TempPass123!',
    });

    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(403);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('allows change-password even when mustChangePassword is true', async () => {
    const school = await School.create({
      name:  'Test School 2',
      email: 'test2@school.ke',
      phone: '+254712000002',
    });

    await User.create({
      firstName:          'Staff',
      lastName:           'Member',
      email:              'staff2@school.ke',
      password:           'TempPass123!',
      role:               'teacher',
      schoolId:           school._id,
      mustChangePassword: true,
      emailVerified:      true,
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email:    'staff2@school.ke',
      password: 'TempPass123!',
    });

    const res = await agent.post('/api/v1/auth/change-password').send({
      currentPassword: 'TempPass123!',
      newPassword:     'NewPassword456!',
    });

    expect(res.status).toBe(200);
  });
});
