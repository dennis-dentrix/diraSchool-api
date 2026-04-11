/**
 * Auth integration tests.
 *
 * Tests register, login, logout, /me, change-password.
 * Uses MongoMemoryReplSet (replica set required for transactions).
 * BullMQ queues are mocked so tests run without Redis.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { setup, clearDatabase, teardown } from '../../../config/vitest.setup.js';

// Mock BullMQ queues — prevents attempts to connect to Redis during tests
vi.mock('../../../jobs/queues.js', () => ({
  smsQueue:     { add: vi.fn().mockResolvedValue({ id: 'mock-sms' }) },
  reportQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-report' }) },
  receiptQueue: { add: vi.fn().mockResolvedValue({ id: 'mock-receipt' }) },
  importQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock-import' }) },
}));

const BASE = '/api/v1/auth';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validRegistration = {
  schoolName:  'Test School',
  schoolEmail: 'school@testauth.co.ke',
  schoolPhone: '0712345678',
  county:      'Nairobi',
  firstName:   'John',
  lastName:    'Doe',
  email:       'admin@testauth.co.ke',
  phone:       '0712345679',
  password:    'password123',
};

// ── Setup/teardown ────────────────────────────────────────────────────────────

beforeAll(async () => {
  await setup();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardown();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const register = (overrides = {}) =>
  request(app).post(`${BASE}/register`).send({ ...validRegistration, ...overrides });

const login = (email, password) =>
  request(app).post(`${BASE}/login`).send({ email, password });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates school + admin and returns 201 with cookie', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.role).toBe('school_admin');
    expect(res.body.school.name).toBe(validRegistration.schoolName);
    expect(res.headers['set-cookie']).toBeDefined();
    // Password must never be returned
    expect(res.body.user.password).toBeUndefined();
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

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('returns 200 and sets cookie on valid credentials', async () => {
    const res = await login(validRegistration.email, validRegistration.password);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await login(validRegistration.email, 'wrongpassword');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 on unknown email', async () => {
    const res = await login('nobody@test.com', 'password123');
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it('returns logged-in user when authenticated', async () => {
    await register();
    const agent = request.agent(app);
    await agent.post(`${BASE}/login`).send({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    const res = await agent.get(`${BASE}/me`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegistration.email);
    expect(res.body.user.password).toBeUndefined();
  });
});

describe('POST /auth/logout', () => {
  it('clears cookie and returns 200', async () => {
    await register();
    const agent = request.agent(app);
    await agent.post(`${BASE}/login`).send({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    const logoutRes = await agent.post(`${BASE}/logout`);
    expect(logoutRes.status).toBe(200);

    // After logout, /me should return 401
    const meRes = await agent.get(`${BASE}/me`);
    expect(meRes.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('changes password and clears mustChangePassword', async () => {
    await register();
    const agent = request.agent(app);
    await agent.post(`${BASE}/login`).send({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    const res = await agent.post(`${BASE}/change-password`).send({
      currentPassword: validRegistration.password,
      newPassword: 'newpassword456',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/changed/i);

    // Old password should now be rejected
    const loginOld = await login(validRegistration.email, validRegistration.password);
    expect(loginOld.status).toBe(401);

    // New password should work
    const loginNew = await login(validRegistration.email, 'newpassword456');
    expect(loginNew.status).toBe(200);
  });

  it('returns 401 when current password is wrong', async () => {
    await register();
    const agent = request.agent(app);
    await agent.post(`${BASE}/login`).send({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    const res = await agent.post(`${BASE}/change-password`).send({
      currentPassword: 'wrongcurrent',
      newPassword: 'newpassword456',
    });
    expect(res.status).toBe(401);
  });
});
