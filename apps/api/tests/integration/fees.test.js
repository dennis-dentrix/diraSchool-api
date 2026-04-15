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
  schoolName: 'Greenfield Academy',
  schoolEmail: 'admin@greenfield.sc.ke',
  schoolPhone: '0731000001',
  county: 'Nairobi',
  firstName: 'Esther',
  lastName: 'Wanjiku',
  email: 'esther@greenfield.sc.ke',
  phone: '0731000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Redwood School',
  schoolEmail: 'admin@redwood.sc.ke',
  schoolPhone: '0731000002',
  county: 'Kisumu',
  firstName: 'Brian',
  lastName: 'Odhiambo',
  email: 'brian@redwood.sc.ke',
  phone: '0731000002',
  password: 'SecurePass1!',
};

async function createClass(agent, overrides = {}) {
  const res = await agent.post('/api/v1/classes').send({
    name: 'Grade 5',
    levelCategory: 'Upper Primary',
    academicYear: '2025',
    term: 'Term 1',
    ...overrides,
  });
  return res.body.class;
}

let admissionCounter = 1;
function nextAdmission() {
  return `FEE${String(admissionCounter++).padStart(4, '0')}`;
}

async function enrollStudent(agent, classId, overrides = {}) {
  const res = await agent.post('/api/v1/students').send({
    classId,
    admissionNumber: nextAdmission(),
    firstName: 'Learner',
    lastName: 'Test',
    gender: 'female',
    ...overrides,
  });
  return res.body.student;
}

const defaultItems = [
  { name: 'Tuition', amount: 15000 },
  { name: 'Activity', amount: 2000 },
];

async function createFeeStructure(agent, classId, overrides = {}) {
  const res = await agent.post('/api/v1/fees/structures').send({
    classId,
    academicYear: '2025',
    term: 'Term 1',
    items: defaultItems,
    ...overrides,
  });
  return res.body.structure;
}

async function recordPayment(agent, studentId, overrides = {}) {
  const res = await agent.post('/api/v1/fees/payments').send({
    studentId,
    academicYear: '2025',
    term: 'Term 1',
    amount: 10000,
    method: 'mpesa',
    reference: `MPESA${Date.now()}`,
    ...overrides,
  });
  return res.body.payment;
}

// ── POST /api/v1/fees/structures ──────────────────────────────────────────────

describe('POST /api/v1/fees/structures', () => {
  it('creates a fee structure for a class', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/fees/structures').send({
      classId: cls._id,
      academicYear: '2025',
      term: 'Term 1',
      items: [
        { name: 'Tuition', amount: 15000 },
        { name: 'Activity Fee', amount: 2000 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.structure.totalAmount).toBe(17000);
    expect(res.body.structure.items).toHaveLength(2);
    expect(res.body.structure.classId._id).toBe(cls._id);
  });

  it('rejects duplicate structure for same class/term/year', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    await createFeeStructure(agent, cls._id);
    const res = await agent.post('/api/v1/fees/structures').send({
      classId: cls._id,
      academicYear: '2025',
      term: 'Term 1',
      items: [{ name: 'Tuition', amount: 12000 }],
    });

    expect(res.status).toBe(409);
  });

  it('returns 404 when classId belongs to another school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    const res = await agentB.post('/api/v1/fees/structures').send({
      classId: clsA._id,
      academicYear: '2025',
      term: 'Term 1',
      items: [{ name: 'Tuition', amount: 10000 }],
    });

    expect(res.status).toBe(404);
  });

  it('rejects request with no items', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    const res = await agent.post('/api/v1/fees/structures').send({
      classId: cls._id,
      academicYear: '2025',
      term: 'Term 1',
      items: [],
    });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/fees/structures').send({
      classId: '000000000000000000000001',
      academicYear: '2025',
      term: 'Term 1',
      items: [{ name: 'Tuition', amount: 1000 }],
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/fees/structures ───────────────────────────────────────────────

describe('GET /api/v1/fees/structures', () => {
  it('lists fee structures for a school with filters', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls1 = await createClass(agent);
    const cls2 = await createClass(agent, { name: 'Grade 6' });

    await createFeeStructure(agent, cls1._id);
    await createFeeStructure(agent, cls2._id);

    const listAll = await agent.get('/api/v1/fees/structures');
    expect(listAll.status).toBe(200);
    expect(listAll.body.structures.length).toBe(2);

    const listFiltered = await agent.get(
      `/api/v1/fees/structures?classId=${cls1._id}`
    );
    expect(listFiltered.body.structures.length).toBe(1);
  });

  it('enforces tenant isolation', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);

    await createFeeStructure(agentA, clsA._id);

    const res = await agentB.get('/api/v1/fees/structures');
    expect(res.status).toBe(200);
    expect(res.body.structures.length).toBe(0);
  });
});

// ── PATCH /api/v1/fees/structures/:id ────────────────────────────────────────

describe('PATCH /api/v1/fees/structures/:id', () => {
  it('updates items and recalculates totalAmount', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const structure = await createFeeStructure(agent, cls._id); // 17000

    const res = await agent.patch(`/api/v1/fees/structures/${structure._id}`).send({
      items: [
        { name: 'Tuition', amount: 18000 },
        { name: 'Meals', amount: 3000 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.structure.totalAmount).toBe(21000);
  });

  it('rejects unknown fields (.strict())', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const structure = await createFeeStructure(agent, cls._id);

    const res = await agent.patch(`/api/v1/fees/structures/${structure._id}`).send({
      classId: 'hijack',
    });

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/fees/structures/:id ───────────────────────────────────────

describe('DELETE /api/v1/fees/structures/:id', () => {
  it('deletes a structure when no completed payments exist', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const structure = await createFeeStructure(agent, cls._id);

    const res = await agent.delete(`/api/v1/fees/structures/${structure._id}`);
    expect(res.status).toBe(200);

    const check = await agent.get(`/api/v1/fees/structures/${structure._id}`);
    expect(check.status).toBe(404);
  });

  it('blocks deletion when payments exist for that term', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const structure = await createFeeStructure(agent, cls._id);
    const student = await enrollStudent(agent, cls._id);

    await recordPayment(agent, student._id);

    const res = await agent.delete(`/api/v1/fees/structures/${structure._id}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/payment/i);
  });
});

// ── POST /api/v1/fees/payments ────────────────────────────────────────────────

describe('POST /api/v1/fees/payments', () => {
  it('records a payment for an active student', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const res = await agent.post('/api/v1/fees/payments').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
      amount: 8000,
      method: 'cash',
    });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(8000);
    expect(res.body.payment.method).toBe('cash');
    expect(res.body.payment.status).toBe('completed');
    expect(res.body.payment.studentId._id).toBe(student._id);
  });

  it('auto-sets classId from the student', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const res = await agent.post('/api/v1/fees/payments').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 2',
      amount: 5000,
      method: 'bank',
      reference: 'BANK-REF-001',
    });

    expect(res.status).toBe(201);
    expect(res.body.payment.classId._id).toBe(cls._id);
  });

  it('rejects payment for student in another school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);

    const res = await agentB.post('/api/v1/fees/payments').send({
      studentId: studentA._id,
      academicYear: '2025',
      term: 'Term 1',
      amount: 5000,
      method: 'cash',
    });

    expect(res.status).toBe(404);
  });

  it('rejects negative or zero amount', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const res = await agent.post('/api/v1/fees/payments').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
      amount: 0,
      method: 'cash',
    });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/fees/payments ─────────────────────────────────────────────────

describe('GET /api/v1/fees/payments', () => {
  it('lists payments for a school', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Alpha' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Beta' });

    await recordPayment(agent, s1._id);
    await recordPayment(agent, s2._id, { amount: 5000 });

    const res = await agent.get('/api/v1/fees/payments');
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters payments by studentId', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Alpha' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Beta' });

    await recordPayment(agent, s1._id);
    await recordPayment(agent, s2._id);

    const res = await agent.get(`/api/v1/fees/payments?studentId=${s1._id}`);
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(1);
    expect(res.body.payments[0].studentId._id).toBe(s1._id);
  });

  it('enforces tenant isolation', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);

    await recordPayment(agentA, studentA._id);

    const res = await agentB.get('/api/v1/fees/payments');
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(0);
  });
});

// ── POST /api/v1/fees/payments/:id/reverse ───────────────────────────────────

describe('POST /api/v1/fees/payments/:id/reverse', () => {
  it('reverses a completed payment', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const payment = await recordPayment(agent, student._id);

    const res = await agent.post(`/api/v1/fees/payments/${payment._id}/reverse`).send({
      reversalReason: 'Payment made in error.',
    });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('reversed');
    expect(res.body.payment.reversalReason).toBe('Payment made in error.');
    expect(res.body.payment.reversedAt).toBeDefined();
  });

  it('cannot reverse an already-reversed payment', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const payment = await recordPayment(agent, student._id);

    await agent.post(`/api/v1/fees/payments/${payment._id}/reverse`).send({
      reversalReason: 'First reversal.',
    });

    const res = await agent.post(`/api/v1/fees/payments/${payment._id}/reverse`).send({
      reversalReason: 'Second reversal.',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already reversed/i);
  });

  it('requires a reversal reason', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const payment = await recordPayment(agent, student._id);

    const res = await agent.post(`/api/v1/fees/payments/${payment._id}/reverse`).send({});
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/fees/balance ──────────────────────────────────────────────────

describe('GET /api/v1/fees/balance', () => {
  it('returns balance with outstanding amount', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);

    // Fee structure: 17000
    await createFeeStructure(agent, cls._id);
    const student = await enrollStudent(agent, cls._id);

    // Record two payments totalling 12000
    await recordPayment(agent, student._id, { amount: 7000 });
    await recordPayment(agent, student._id, { amount: 5000 });

    const res = await agent.get(
      `/api/v1/fees/balance?studentId=${student._id}&academicYear=2025&term=Term 1`
    );

    expect(res.status).toBe(200);
    expect(res.body.totalPaid).toBe(12000);
    expect(res.body.outstanding).toBe(5000);
    expect(res.body.isPaidUp).toBe(false);
    expect(res.body.feeStructure.totalAmount).toBe(17000);
  });

  it('shows isPaidUp when fully paid', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    await createFeeStructure(agent, cls._id); // 17000
    const student = await enrollStudent(agent, cls._id);

    await recordPayment(agent, student._id, { amount: 17000 });

    const res = await agent.get(
      `/api/v1/fees/balance?studentId=${student._id}&academicYear=2025&term=Term 1`
    );

    expect(res.status).toBe(200);
    expect(res.body.isPaidUp).toBe(true);
    expect(res.body.outstanding).toBe(0);
  });

  it('excludes reversed payments from totalPaid', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    await createFeeStructure(agent, cls._id); // 17000
    const student = await enrollStudent(agent, cls._id);

    // Pay 10000 then reverse it; also pay 5000 (kept)
    const reversedPayment = await recordPayment(agent, student._id, { amount: 10000 });
    await agent.post(`/api/v1/fees/payments/${reversedPayment._id}/reverse`).send({
      reversalReason: 'Error',
    });
    await recordPayment(agent, student._id, { amount: 5000 });

    const res = await agent.get(
      `/api/v1/fees/balance?studentId=${student._id}&academicYear=2025&term=Term 1`
    );

    expect(res.status).toBe(200);
    expect(res.body.totalPaid).toBe(5000); // reversed payment excluded
    expect(res.body.outstanding).toBe(12000);
  });

  it('returns null feeStructure and 0 outstanding when no structure defined', async () => {
    const agent = await registerAndLogin(app, schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const res = await agent.get(
      `/api/v1/fees/balance?studentId=${student._id}&academicYear=2025&term=Term 1`
    );

    expect(res.status).toBe(200);
    expect(res.body.feeStructure).toBeNull();
    expect(res.body.outstanding).toBe(0);
    expect(res.body.totalPaid).toBe(0);
  });

  it('returns 404 for student in different school', async () => {
    const agentA = await registerAndLogin(app, schoolA);
    const agentB = await registerAndLogin(app, schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);

    const res = await agentB.get(
      `/api/v1/fees/balance?studentId=${studentA._id}&academicYear=2025&term=Term 1`
    );

    expect(res.status).toBe(404);
  });
});
