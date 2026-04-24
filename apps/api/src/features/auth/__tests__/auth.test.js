/**
 * Auth integration tests.
 *
 * Tests register, email verification, login, logout, /me, change-password,
 * forgot-password, reset-password, accept-invite.
 *
 * Uses MongoMemoryReplSet (replica set required for transactions).
 * BullMQ queues are mocked so tests run without Redis.
 */
import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { setup, clearDatabase, teardown } from '../../../config/vitest.setup.js';
import User from '../../users/User.model.js';

// Mock BullMQ queues — prevents attempts to connect to Redis during tests
vi.mock('../../../jobs/queues.js', () => ({
  smsQueue:     { add: vi.fn().mockResolvedValue({ id: 'mock-sms' }) },
  reportQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-report' }) },
  receiptQueue: { add: vi.fn().mockResolvedValue({ id: 'mock-receipt' }) },
  importQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-import' }) },
  emailQueue:   { add: vi.fn().mockResolvedValue({ id: 'mock-email' }) },
}));

// Mock email service — prevents real SMTP calls during tests
vi.mock('../../../services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({}),
  sendInviteEmail: vi.fn().mockResolvedValue({}),
  sendNewSchoolNotification: vi.fn().mockResolvedValue({}),
}));

const BASE = '/api/v1/auth';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validRegistration = {
  schoolName:  'Test School',
  schoolPhone: '0712345678',
  county:      'Nairobi',
  firstName:   'John',
  lastName:    'Doe',
  email:       'admin@testauth.co.ke',
  phone:       '0712345679',
  password:    'password123',
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(setup);
afterEach(clearDatabase);
afterAll(teardown);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** POST /register */
const register = (overrides = {}) =>
  request(app).post(`${BASE}/register`).send({ ...validRegistration, ...overrides });

/**
 * Injects a known OTP + raw token into the DB so tests run without real email.
 * Returns { code, rawToken } — use code for POST /verify-email,
 * rawToken for GET /verify-email/:token.
 */
const injectVerifyCredentials = async (email, code = '123456') => {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await User.updateOne(
    { email },
    {
      emailVerificationCode:   code,
      emailVerificationToken:  tokenHash,
      emailVerificationExpiry: new Date(Date.now() + 30 * 60 * 1000),
    }
  );
  return { code, rawToken };
};

/** Convenience alias — most tests only need the code. */
const injectVerifyOtp = async (email, code = '123456') => {
  const { code: c } = await injectVerifyCredentials(email, code);
  return c;
};

/**
 * Register + verify email in one step.
 * Returns the verify response (user is auto-logged in via cookie).
 */
const registerAndVerify = async (overrides = {}) => {
  await register(overrides);
  const email = overrides.email ?? validRegistration.email;
  const code  = await injectVerifyOtp(email);
  const verifyRes = await request(app)
    .post(`${BASE}/verify-email`)
    .send({ email, code });
  expect(verifyRes.status).toBe(200); // sanity-check inside helper
  return verifyRes;
};

/**
 * Register, verify, and return an authenticated cookie agent.
 */
const registerVerifyAndLogin = async (overrides = {}) => {
  await registerAndVerify(overrides);
  const agent = request.agent(app);
  await agent.post(`${BASE}/login`).send({
    email:    overrides.email    ?? validRegistration.email,
    password: overrides.password ?? validRegistration.password,
  });
  return agent;
};

const login = (email, password) =>
  request(app).post(`${BASE}/login`).send({ email, password });

// ── Register ──────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates school + admin, returns 201 with message (no cookie until verified)', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/verification/i);
    expect(res.body.email).toBe(validRegistration.email);
    expect(res.body.school.name).toBe(validRegistration.schoolName);
    // No cookie set — user must verify email first
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects duplicate school email with 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post(`${BASE}/register`).send({ schoolName: 'Only Name' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await register({ password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });
});

// ── Email verification (OTP) ─────────────────────────────────────────────────

describe('POST /auth/verify-email', () => {
  it('verifies email with correct OTP, sets cookie, and returns user', async () => {
    await register();
    const code = await injectVerifyOtp(validRegistration.email);

    const res = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ email: validRegistration.email, code });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined(); // auto-logged in
    expect(res.body.message).toMatch(/verified/i);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('returns 400 for a wrong code', async () => {
    await register();
    await injectVerifyOtp(validRegistration.email, '123456');

    const res = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ email: validRegistration.email, code: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 400 for an expired OTP', async () => {
    await register();
    await injectVerifyOtp(validRegistration.email, '123456');
    // Force-expire the OTP
    await User.updateOne(
      { email: validRegistration.email },
      { emailVerificationExpiry: new Date(Date.now() - 1000) }
    );

    const res = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ email: validRegistration.email, code: '123456' });

    expect(res.status).toBe(400);
  });

  it('OTP is single-use — second submit returns 400', async () => {
    await register();
    const code = await injectVerifyOtp(validRegistration.email);

    await request(app).post(`${BASE}/verify-email`).send({ email: validRegistration.email, code });
    const res = await request(app).post(`${BASE}/verify-email`).send({ email: validRegistration.email, code });

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-existent email', async () => {
    const res = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ email: 'nobody@nowhere.com', code: '123456' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when code format is invalid', async () => {
    const res = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ email: validRegistration.email, code: 'abc' });

    expect(res.status).toBe(400);
  });
});

// ── Fallback link verification (GET /:token) ─────────────────────────────────

describe('GET /auth/verify-email/:token', () => {
  it('verifies email via link, sets cookie, returns user', async () => {
    await register();
    const { rawToken } = await injectVerifyCredentials(validRegistration.email);

    const res = await request(app).get(`${BASE}/verify-email/${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.message).toMatch(/verified/i);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('returns 400 for a wrong token', async () => {
    const res = await request(app).get(`${BASE}/verify-email/totallywrongtoken`);
    expect(res.status).toBe(400);
  });

  it('link is single-use — second click returns 400', async () => {
    await register();
    const { rawToken } = await injectVerifyCredentials(validRegistration.email);

    await request(app).get(`${BASE}/verify-email/${rawToken}`); // first use
    const res = await request(app).get(`${BASE}/verify-email/${rawToken}`); // second use

    expect(res.status).toBe(400);
  });
});

// ── Resend verification ───────────────────────────────────────────────────────

describe('POST /auth/resend-verification', () => {
  it('returns 200 and queues a new email', async () => {
    await register();

    const res = await request(app)
      .post(`${BASE}/resend-verification`)
      .send({ email: validRegistration.email });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sent/i);
  });

  it('returns 200 even when email does not exist (no enumeration)', async () => {
    const res = await request(app)
      .post(`${BASE}/resend-verification`)
      .send({ email: 'nobody@nowhere.com' });

    expect(res.status).toBe(200);
  });

  it('returns 200 silently for already-verified accounts (no enumeration)', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post(`${BASE}/resend-verification`)
      .send({ email: validRegistration.email });

    expect(res.status).toBe(200);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns 200 and sets cookie after email is verified', async () => {
    await registerAndVerify();

    const res = await login(validRegistration.email, validRegistration.password);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 403 when email is not yet verified', async () => {
    await register(); // no verify step

    const res = await login(validRegistration.email, validRegistration.password);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it('returns 401 on wrong password', async () => {
    await registerAndVerify();
    const res = await login(validRegistration.email, 'wrongpassword');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 on unknown email', async () => {
    const res = await login('nobody@test.com', 'password123');
    expect(res.status).toBe(401);
  });
});

// ── GET /me ───────────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it('returns the logged-in user', async () => {
    const agent = await registerVerifyAndLogin();
    const res = await agent.get(`${BASE}/me`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.password).toBeUndefined();
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('clears cookie and subsequent /me returns 401', async () => {
    const agent = await registerVerifyAndLogin();

    const logoutRes = await agent.post(`${BASE}/logout`);
    expect(logoutRes.status).toBe(200);

    const meRes = await agent.get(`${BASE}/me`);
    expect(meRes.status).toBe(401);
  });
});

// ── Forgot password ───────────────────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  it('returns 200 (no token in body) — token sent by email', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: validRegistration.email });

    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
    expect(res.body.message).toMatch(/reset link/i);
  });

  it('returns 200 even when email does not exist (no enumeration)', async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: 'nobody@nonexistent.com' });

    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

// ── Reset password ────────────────────────────────────────────────────────────

/**
 * Helper: insert a known raw reset token into the DB so we can use it in tests.
 */
const getRawResetToken = async (email) => {
  await request(app).post(`${BASE}/forgot-password`).send({ email });
  const rawToken = crypto.randomBytes(32).toString('hex');
  await User.updateOne(
    { email },
    {
      passwordResetToken:  crypto.createHash('sha256').update(rawToken).digest('hex'),
      passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
    }
  );
  return rawToken;
};

describe('POST /auth/reset-password/:token', () => {
  it('resets password, sets cookie, and logs user in', async () => {
    await registerAndVerify();
    const resetToken = await getRawResetToken(validRegistration.email);

    const res = await request(app)
      .post(`${BASE}/reset-password/${resetToken}`)
      .send({ password: 'NewPassword99!' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.message).toMatch(/reset successfully/i);

    // Old password rejected
    const oldLogin = await login(validRegistration.email, validRegistration.password);
    expect(oldLogin.status).toBe(401);

    // New password works
    const newLogin = await login(validRegistration.email, 'NewPassword99!');
    expect(newLogin.status).toBe(200);
  });

  it('returns 400 for an invalid token', async () => {
    const res = await request(app)
      .post(`${BASE}/reset-password/thisisatotallywrongtoken`)
      .send({ password: 'NewPassword99!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 400 when new password is too short', async () => {
    await registerAndVerify();
    const resetToken = await getRawResetToken(validRegistration.email);

    const res = await request(app)
      .post(`${BASE}/reset-password/${resetToken}`)
      .send({ password: 'short' });

    expect(res.status).toBe(400);
  });
});

// ── Change password ───────────────────────────────────────────────────────────

describe('POST /auth/change-password', () => {
  it('changes password successfully', async () => {
    const agent = await registerVerifyAndLogin();

    const res = await agent.post(`${BASE}/change-password`).send({
      currentPassword: validRegistration.password,
      newPassword:     'newpassword456',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/changed/i);

    // Old password rejected
    const loginOld = await login(validRegistration.email, validRegistration.password);
    expect(loginOld.status).toBe(401);

    // New password works
    const loginNew = await login(validRegistration.email, 'newpassword456');
    expect(loginNew.status).toBe(200);
  });

  it('returns 401 when current password is wrong', async () => {
    const agent = await registerVerifyAndLogin();

    const res = await agent.post(`${BASE}/change-password`).send({
      currentPassword: 'wrongcurrent',
      newPassword:     'newpassword456',
    });

    expect(res.status).toBe(401);
  });
});
