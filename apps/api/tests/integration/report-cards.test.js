import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { setup, teardown, clearDatabase } from '../../src/config/vitest.setup.js';

beforeAll(setup);
afterAll(teardown);
beforeEach(clearDatabase);

// ── Helpers ───────────────────────────────────────────────────────────────────

const schoolA = {
  schoolName: 'Sunrise Academy',
  schoolEmail: 'admin@sunrise.sc.ke',
  schoolPhone: '0740000001',
  county: 'Nairobi',
  firstName: 'Grace',
  lastName: 'Achieng',
  email: 'grace@sunrise.sc.ke',
  phone: '0740000001',
  password: 'SecurePass1!',
};

const schoolB = {
  schoolName: 'Lakeside School',
  schoolEmail: 'admin@lakeside.sc.ke',
  schoolPhone: '0740000002',
  county: 'Kisumu',
  firstName: 'Tom',
  lastName: 'Otieno',
  email: 'tom@lakeside.sc.ke',
  phone: '0740000002',
  password: 'SecurePass1!',
};

async function registerAndLogin(schoolData) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/register').send(schoolData);
  return agent;
}

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
  return `RPT${String(admissionCounter++).padStart(4, '0')}`;
}

async function enrollStudent(agent, classId, overrides = {}) {
  const res = await agent.post('/api/v1/students').send({
    classId,
    admissionNumber: nextAdmission(),
    firstName: 'Learner',
    lastName: 'Test',
    gender: 'male',
    ...overrides,
  });
  return res.body.student;
}

async function createSubject(agent, classId, name = 'Mathematics') {
  const res = await agent.post('/api/v1/subjects').send({ classId, name });
  return res.body.subject;
}

async function createExam(agent, classId, subjectId, overrides = {}) {
  const res = await agent.post('/api/v1/exams').send({
    classId,
    subjectId,
    name: 'Midterm',
    type: 'midterm',
    totalMarks: 100,
    ...overrides,
  });
  return res.body.exam;
}

async function recordResults(agent, examId, entries) {
  const res = await agent.post('/api/v1/results/bulk').send({ examId, entries });
  return res.body.results;
}

async function createAttendanceRegister(agent, classId, date, entries = []) {
  const res = await agent.post('/api/v1/attendance/registers').send({
    classId,
    date,
    entries,
  });
  return res.body.register;
}

async function submitRegister(agent, registerId) {
  const res = await agent.post(`/api/v1/attendance/registers/${registerId}/submit`);
  return res.body.register;
}

// ── POST /api/v1/report-cards/generate ───────────────────────────────────────

describe('POST /api/v1/report-cards/generate', () => {
  it('generates a report card aggregating results across subjects', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);

    const mathSubject = await createSubject(agent, cls._id, 'Mathematics');
    const engSubject = await createSubject(agent, cls._id, 'English');

    const mathExam = await createExam(agent, cls._id, mathSubject._id, { name: 'Math Midterm' });
    const engExam = await createExam(agent, cls._id, engSubject._id, { name: 'Eng Midterm' });

    // Math: 80/100 → 80% → EE (Upper Primary)
    // English: 52/100 → 52% → ME
    await recordResults(agent, mathExam._id, [{ studentId: student._id, marks: 80 }]);
    await recordResults(agent, engExam._id, [{ studentId: student._id, marks: 52 }]);

    const res = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');

    const card = res.body.reportCard;
    expect(card.status).toBe('draft');
    expect(card.subjects).toHaveLength(2);

    // Verify subject grades
    const math = card.subjects.find((s) => s.subjectName === 'Mathematics');
    const eng = card.subjects.find((s) => s.subjectName === 'English');
    expect(math.grade).toBe('EE');
    expect(math.points).toBe(4);
    expect(eng.grade).toBe('ME');
    expect(eng.points).toBe(3);

    // Overall: (80 + 52) / 200 = 66% → ME
    expect(card.overallGrade).toBe('ME');
    expect(card.totalPoints).toBe(7); // 4 + 3
    expect(card.averagePoints).toBe(3.5);
  });

  it('correctly uses weighted average when a subject has multiple exams', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id, 'Science');

    // Opener: 20/50 = 40%
    // Endterm: 70/100 = 70%
    // Weighted: (20+70)/(50+100) = 90/150 = 60% → ME
    const opener = await createExam(agent, cls._id, subject._id, {
      name: 'Science Opener', type: 'opener', totalMarks: 50,
    });
    const endterm = await createExam(agent, cls._id, subject._id, {
      name: 'Science Endterm', type: 'endterm', totalMarks: 100,
    });

    await recordResults(agent, opener._id, [{ studentId: student._id, marks: 20 }]);
    await recordResults(agent, endterm._id, [{ studentId: student._id, marks: 70 }]);

    const res = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
    });

    expect(res.status).toBe(201);
    const sci = res.body.reportCard.subjects[0];
    expect(sci.averagePercentage).toBe(60); // 90/150 × 100
    expect(sci.grade).toBe('ME');
    expect(sci.exams).toHaveLength(2);
  });

  it('uses the 8-level CBC rubric for Junior Secondary', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent, {
      name: 'Grade 8',
      levelCategory: 'Junior Secondary',
    });
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id, 'Integrated Science');
    const exam = await createExam(agent, cls._id, subject._id, { name: 'JS Midterm' });

    // 92% → EE1 (≥ 90%)
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 92 }]);

    const res = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
    });

    expect(res.status).toBe(201);
    expect(res.body.reportCard.subjects[0].grade).toBe('EE1');
    expect(res.body.reportCard.subjects[0].points).toBe(8);
  });

  it('includes attendance summary from submitted registers', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    // Create 3 registers: present, absent, late
    const reg1 = await createAttendanceRegister(agent, cls._id, '2025-04-01', [
      { studentId: student._id, status: 'present' },
    ]);
    const reg2 = await createAttendanceRegister(agent, cls._id, '2025-04-02', [
      { studentId: student._id, status: 'absent' },
    ]);
    const reg3 = await createAttendanceRegister(agent, cls._id, '2025-04-03', [
      { studentId: student._id, status: 'late' },
    ]);
    // Draft register — should NOT be counted
    await createAttendanceRegister(agent, cls._id, '2025-04-04', [
      { studentId: student._id, status: 'absent' },
    ]);

    await submitRegister(agent, reg1._id);
    await submitRegister(agent, reg2._id);
    await submitRegister(agent, reg3._id);

    const res = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id,
      academicYear: '2025',
      term: 'Term 1',
    });

    expect(res.status).toBe(201);
    const att = res.body.reportCard.attendanceSummary;
    expect(att.totalDays).toBe(3); // only submitted registers
    expect(att.present).toBe(1);
    expect(att.absent).toBe(1);
    expect(att.late).toBe(1);
  });

  it('regenerating a draft updates the data and preserves existing remarks', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 50 }]);

    // First generation
    const first = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = first.body.reportCard._id;

    // Add remarks
    await agent.patch(`/api/v1/report-cards/${cardId}/remarks`).send({
      teacherRemarks: 'Good effort.',
    });

    // Update result and regenerate
    const resultId = (
      await agent.get(`/api/v1/results?studentId=${student._id}`)
    ).body.results[0]._id;
    await agent.patch(`/api/v1/results/${resultId}`).send({ marks: 85 });

    const regen = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });

    expect(regen.status).toBe(200); // 200 = existing card updated
    expect(regen.body.reportCard._id).toBe(cardId);
    expect(regen.body.reportCard.subjects[0].grade).toBe('EE'); // updated from ME
    expect(regen.body.reportCard.teacherRemarks).toBe('Good effort.'); // preserved
  });

  it('blocks regeneration of a published card', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    await agent.post(`/api/v1/report-cards/${genRes.body.reportCard._id}/publish`);

    const regenRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    expect(regenRes.status).toBe(409);
    expect(regenRes.body.message).toMatch(/already published/i);
  });

  it('returns 404 for student in another school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);

    const res = await agentB.post('/api/v1/report-cards/generate').send({
      studentId: studentA._id, academicYear: '2025', term: 'Term 1',
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/report-cards/generate').send({
      studentId: '000000000000000000000001', academicYear: '2025', term: 'Term 1',
    });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/report-cards/generate-class ─────────────────────────────────

describe('POST /api/v1/report-cards/generate-class', () => {
  it('generates report cards for all active students in a class', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Alpha' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Beta' });
    const s3 = await enrollStudent(agent, cls._id, { firstName: 'Gamma' });

    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [
      { studentId: s1._id, marks: 80 },
      { studentId: s2._id, marks: 60 },
      { studentId: s3._id, marks: 40 },
    ]);

    const res = await agent.post('/api/v1/report-cards/generate-class').send({
      classId: cls._id,
      academicYear: '2025',
      term: 'Term 1',
    });

    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(3);
    expect(res.body.skipped).toBe(0);

    const list = await agent.get('/api/v1/report-cards');
    expect(list.body.reportCards.length).toBe(3);
  });

  it('skips published cards in a class bulk generate', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Alpha' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Beta' });

    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [
      { studentId: s1._id, marks: 70 },
      { studentId: s2._id, marks: 55 },
    ]);

    // Generate s1's card individually and publish it
    const s1Card = await agent.post('/api/v1/report-cards/generate').send({
      studentId: s1._id, academicYear: '2025', term: 'Term 1',
    });
    await agent.post(`/api/v1/report-cards/${s1Card.body.reportCard._id}/publish`);

    // Bulk generate — s1 should be skipped, s2 generated
    const res = await agent.post('/api/v1/report-cards/generate-class').send({
      classId: cls._id, academicYear: '2025', term: 'Term 1',
    });

    expect(res.status).toBe(200);
    expect(res.body.generated).toBe(1);
    expect(res.body.skipped).toBe(1);
  });

  it('returns 404 for class in another school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const clsA = await createClass(agentA);

    const res = await agentB.post('/api/v1/report-cards/generate-class').send({
      classId: clsA._id, academicYear: '2025', term: 'Term 1',
    });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/report-cards ──────────────────────────────────────────────────

describe('GET /api/v1/report-cards', () => {
  it('lists report cards and filters by status', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const s1 = await enrollStudent(agent, cls._id, { firstName: 'Alpha' });
    const s2 = await enrollStudent(agent, cls._id, { firstName: 'Beta' });
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [
      { studentId: s1._id, marks: 70 },
      { studentId: s2._id, marks: 55 },
    ]);

    const c1 = await agent.post('/api/v1/report-cards/generate').send({
      studentId: s1._id, academicYear: '2025', term: 'Term 1',
    });
    await agent.post('/api/v1/report-cards/generate').send({
      studentId: s2._id, academicYear: '2025', term: 'Term 1',
    });

    // Publish one
    await agent.post(`/api/v1/report-cards/${c1.body.reportCard._id}/publish`);

    const drafts = await agent.get('/api/v1/report-cards?status=draft');
    expect(drafts.body.reportCards.length).toBe(1);
    expect(drafts.body.reportCards[0].status).toBe('draft');

    const published = await agent.get('/api/v1/report-cards?status=published');
    expect(published.body.reportCards.length).toBe(1);
    expect(published.body.reportCards[0].status).toBe('published');
  });

  it('enforces tenant isolation', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);
    const subject = await createSubject(agentA, clsA._id);
    const exam = await createExam(agentA, clsA._id, subject._id);
    await recordResults(agentA, exam._id, [{ studentId: studentA._id, marks: 70 }]);
    await agentA.post('/api/v1/report-cards/generate').send({
      studentId: studentA._id, academicYear: '2025', term: 'Term 1',
    });

    const res = await agentB.get('/api/v1/report-cards');
    expect(res.status).toBe(200);
    expect(res.body.reportCards.length).toBe(0);
  });
});

// ── PATCH /api/v1/report-cards/:id/remarks ───────────────────────────────────

describe('PATCH /api/v1/report-cards/:id/remarks', () => {
  it('adds teacher and principal remarks on a draft', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;

    const res = await agent.patch(`/api/v1/report-cards/${cardId}/remarks`).send({
      teacherRemarks: 'Excellent improvement this term.',
      principalRemarks: 'Keep it up!',
    });

    expect(res.status).toBe(200);
    expect(res.body.reportCard.teacherRemarks).toBe('Excellent improvement this term.');
    expect(res.body.reportCard.principalRemarks).toBe('Keep it up!');
  });

  it('rejects remarks update on a published card', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;
    await agent.post(`/api/v1/report-cards/${cardId}/publish`);

    const res = await agent.patch(`/api/v1/report-cards/${cardId}/remarks`).send({
      teacherRemarks: 'Too late.',
    });
    expect(res.status).toBe(409);
  });

  it('rejects body with no recognised remark fields', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 60 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;

    const res = await agent.patch(`/api/v1/report-cards/${cardId}/remarks`).send({});
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/report-cards/:id/publish ────────────────────────────────────

describe('POST /api/v1/report-cards/:id/publish', () => {
  it('publishes a draft report card', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;

    const res = await agent.post(`/api/v1/report-cards/${cardId}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.reportCard.status).toBe('published');
    expect(res.body.reportCard.publishedAt).toBeDefined();
  });

  it('returns 400 when already published', async () => {
    const agent = await registerAndLogin(schoolA);
    const cls = await createClass(agent);
    const student = await enrollStudent(agent, cls._id);
    const subject = await createSubject(agent, cls._id);
    const exam = await createExam(agent, cls._id, subject._id);
    await recordResults(agent, exam._id, [{ studentId: student._id, marks: 70 }]);

    const genRes = await agent.post('/api/v1/report-cards/generate').send({
      studentId: student._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;

    await agent.post(`/api/v1/report-cards/${cardId}/publish`);
    const res = await agent.post(`/api/v1/report-cards/${cardId}/publish`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for card in another school', async () => {
    const agentA = await registerAndLogin(schoolA);
    const agentB = await registerAndLogin(schoolB);
    const clsA = await createClass(agentA);
    const studentA = await enrollStudent(agentA, clsA._id);
    const subject = await createSubject(agentA, clsA._id);
    const exam = await createExam(agentA, clsA._id, subject._id);
    await recordResults(agentA, exam._id, [{ studentId: studentA._id, marks: 70 }]);

    const genRes = await agentA.post('/api/v1/report-cards/generate').send({
      studentId: studentA._id, academicYear: '2025', term: 'Term 1',
    });
    const cardId = genRes.body.reportCard._id;

    const res = await agentB.post(`/api/v1/report-cards/${cardId}/publish`);
    expect(res.status).toBe(404);
  });
});
