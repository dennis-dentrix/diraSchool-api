/**
 * Fees integration tests.
 * Tests fee structures, payments, balance query, and payment reversal.
 * BullMQ queues mocked so receipt jobs don't fail on missing Redis.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { setup, clearDatabase, teardown } from '../../../config/vitest.setup.js';
import School from '../../schools/School.model.js';
import User from '../../users/User.model.js';
import Class from '../../classes/Class.model.js';
import Student from '../../students/Student.model.js';
import { LEVEL_CATEGORIES } from '../../../constants/index.js';

// Mock queues
vi.mock('../../../jobs/queues.js', () => ({
  smsQueue:     { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  reportQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  receiptQueue: { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  importQueue:  { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
  emailQueue:   { add: vi.fn().mockResolvedValue({ id: 'mock' }) },
}));

const BASE = '/api/v1/fees';
const AUTH_BASE = '/api/v1/auth';

beforeAll(async () => { await setup(); });
beforeEach(async () => { await clearDatabase(); });  // ensure clean slate at the start of every test
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await teardown(); });

// ── Test fixture builder ──────────────────────────────────────────────────────

const buildFixtures = async () => {
  // Create school + admin via register endpoint
  const regRes = await request(app).post(`${AUTH_BASE}/register`).send({
    schoolName:  'Fee Test School',
    schoolEmail: 'school@feetest.co.ke',
    schoolPhone: '0711111111',
    firstName:   'Admin',
    lastName:    'User',
    email:       'admin@feetest.co.ke',
    phone:       '0711111112',
    password:    'password123',
  });

  const { school } = regRes.body;

  // Bypass email verification for tests
  await User.updateOne(
    { email: 'admin@feetest.co.ke' },
    { $set: { emailVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpiry: 1 } }
  );

  // Login and get authenticated agent
  const agent = request.agent(app);
  await agent.post(`${AUTH_BASE}/login`).send({
    email: 'admin@feetest.co.ke',
    password: 'password123',
  });

  // Create a class directly via model (avoids needing class API)
  const cls = await Class.create({
    schoolId:      school._id,
    name:          'Grade 4',
    levelCategory: LEVEL_CATEGORIES.UPPER_PRIMARY,
    academicYear:  '2025',
    term:          'Term 1',
  });

  // Create a student directly
  const student = await Student.create({
    schoolId:        school._id,
    classId:         cls._id,
    admissionNumber: 'S001',
    firstName:       'Alice',
    lastName:        'Kamau',
    gender:          'female',
  });

  return { agent, school, cls, student };
};

// ── Fee structures ────────────────────────────────────────────────────────────

describe('POST /fees/structures', () => {
  it('creates a fee structure and returns 201', async () => {
    const { agent, cls } = await buildFixtures();

    const res = await agent.post(`${BASE}/structures`).send({
      classId:      cls._id,
      academicYear: '2025',
      term:         'Term 1',
      items: [
        { name: 'Tuition', amount: 10000 },
        { name: 'Lunch',   amount: 3000 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.structure.totalAmount).toBe(13000);
    expect(res.body.structure.items).toHaveLength(2);
  });

  it('returns 404 for a class that does not belong to the school', async () => {
    const { agent } = await buildFixtures();
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await agent.post(`${BASE}/structures`).send({
      classId: fakeId, academicYear: '2025', term: 'Term 1', items: [{ name: 'X', amount: 100 }],
    });

    expect(res.status).toBe(404);
  });
});

describe('GET /fees/structures', () => {
  it('lists fee structures for the school', async () => {
    const { agent, cls } = await buildFixtures();

    await agent.post(`${BASE}/structures`).send({
      classId: cls._id, academicYear: '2025', term: 'Term 1',
      items: [{ name: 'Tuition', amount: 8000 }],
    });

    const res = await agent.get(`${BASE}/structures`);
    expect(res.status).toBe(200);
    expect(res.body.structures.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Payments ──────────────────────────────────────────────────────────────────

describe('POST /fees/payments', () => {
  it('records a payment and returns 201', async () => {
    const { agent, student } = await buildFixtures();

    const res = await agent.post(`${BASE}/payments`).send({
      studentId:    student._id,
      academicYear: '2025',
      term:         'Term 1',
      amount:       5000,
      method:       'mpesa',
      reference:    'NGA12345',
    });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(5000);
    expect(res.body.payment.method).toBe('mpesa');
    expect(res.body.payment.status).toBe('completed');
  });

  it('returns 404 for an unknown student', async () => {
    const { agent } = await buildFixtures();
    const res = await agent.post(`${BASE}/payments`).send({
      studentId:    '64a1b2c3d4e5f6a7b8c9d0e1',
      academicYear: '2025',
      term:         'Term 1',
      amount:       5000,
      method:       'cash',
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /fees/balance', () => {
  it('returns correct balance after a payment', async () => {
    const { agent, cls, student } = await buildFixtures();

    // Create fee structure
    await agent.post(`${BASE}/structures`).send({
      classId: cls._id, academicYear: '2025', term: 'Term 1',
      items: [{ name: 'Tuition', amount: 10000 }],
    });

    // Record partial payment
    await agent.post(`${BASE}/payments`).send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
      amount: 6000, method: 'cash',
    });

    const res = await agent.get(`${BASE}/balance`).query({
      studentId: student._id.toString(), academicYear: '2025', term: 'Term 1',
    });

    expect(res.status).toBe(200);
    expect(res.body.totalPaid).toBe(6000);
    expect(res.body.outstanding).toBe(4000);
    expect(res.body.isPaidUp).toBe(false);
  });
});

describe('POST /fees/payments/:id/reverse', () => {
  it('reverses a completed payment', async () => {
    const { agent, student } = await buildFixtures();

    const createRes = await agent.post(`${BASE}/payments`).send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
      amount: 1000, method: 'bank',
    });

    const paymentId = createRes.body.payment._id;

    const reverseRes = await agent.post(`${BASE}/payments/${paymentId}/reverse`).send({
      reversalReason: 'Test reversal',
    });

    expect(reverseRes.status).toBe(200);
    expect(reverseRes.body.payment.status).toBe('reversed');
    expect(reverseRes.body.payment.reversalReason).toBe('Test reversal');
  });

  it('returns 400 when reversing an already-reversed payment', async () => {
    const { agent, student } = await buildFixtures();

    const createRes = await agent.post(`${BASE}/payments`).send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
      amount: 500, method: 'cash',
    });

    const pid = createRes.body.payment._id;
    await agent.post(`${BASE}/payments/${pid}/reverse`).send({ reversalReason: 'first' });
    const secondReverse = await agent.post(`${BASE}/payments/${pid}/reverse`).send({ reversalReason: 'again' });

    expect(secondReverse.status).toBe(400);
  });
});
