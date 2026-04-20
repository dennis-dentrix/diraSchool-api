/**
 * Seed script — populates the database with realistic Kenyan school data.
 *
 * Usage:
 *   node scripts/seed.js           # adds seed data (safe to re-run with --reset)
 *   node scripts/seed.js --reset   # drops all collections first, then seeds
 *
 * What gets created:
 *   • 1 superadmin
 *   • 2 schools (Nairobi + Nakuru)
 *   • School admins, teachers, secretary, accountant for each school
 *   • Classes (Grade 1–9 spread across both schools)
 *   • Students (8–12 per class) with guardian contacts
 *   • Parent portal users linked to some students
 *   • Subjects per class (CBC curriculum)
 *   • Fee structures (Term 1–3 for each class)
 *   • Payments for ~70% of students (mix of cash, M-Pesa, bank)
 *   • Exams (Opener, Midterm, Endterm) per subject per class
 *   • Results for all students against all exams
 *   • Attendance registers for the last 10 school days per class
 *   • School settings (motto, principal, holidays)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Load .env from project root (two directories up from scripts/)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

// ── Models ────────────────────────────────────────────────────────────────────
// Import directly — avoids triggering env.js validation which requires Redis
import School        from '../src/features/schools/School.model.js';
import User          from '../src/features/users/User.model.js';
import Class         from '../src/features/classes/Class.model.js';
import Student       from '../src/features/students/Student.model.js';
import Subject       from '../src/features/subjects/Subject.model.js';
import Exam          from '../src/features/exams/Exam.model.js';
import Result        from '../src/features/results/Result.model.js';
import FeeStructure  from '../src/features/fees/FeeStructure.model.js';
import Payment       from '../src/features/fees/Payment.model.js';
import Attendance    from '../src/features/attendance/Attendance.model.js';
import SchoolSettings from '../src/features/settings/SchoolSettings.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const hash = (pw) => bcrypt.hash(pw, 10);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pct = (marks, total) => Math.round((marks / total) * 100);

/** Returns dates for the last N weekdays ending today */
function lastWeekdays(n) {
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return dates.reverse();
}

/** Derive CBC grade from percentage (8-point scale for JSS, 4-level for primary) */
function gradeResult(marks, total, isJSS) {
  const p = pct(marks, total);
  if (isJSS) {
    if (p >= 90) return { grade: 'EE1', points: 8 };
    if (p >= 75) return { grade: 'EE2', points: 7 };
    if (p >= 58) return { grade: 'ME1', points: 6 };
    if (p >= 41) return { grade: 'ME2', points: 5 };
    if (p >= 31) return { grade: 'AE1', points: 4 };
    if (p >= 21) return { grade: 'AE2', points: 3 };
    if (p >= 11) return { grade: 'BE1', points: 2 };
    return { grade: 'BE2', points: 1 };
  } else {
    if (p >= 75) return { grade: 'EE', points: null };
    if (p >= 50) return { grade: 'ME', points: null };
    if (p >= 25) return { grade: 'AE', points: null };
    return { grade: 'BE', points: null };
  }
}

// ── Kenyan Name Banks ─────────────────────────────────────────────────────────
const MALE_FIRST   = ['Brian','Kevin','Dennis','Victor','Ian','Felix','Eric','David','Peter','Michael','James','Samuel','Daniel','Mark','Joseph','Paul','John','Moses','George','Alex','Emmanuel','Joshua','Elijah','Nathan','Adrian','Caleb','Liam','Oliver','Ethan','Noah'];
const FEMALE_FIRST = ['Faith','Grace','Mercy','Joy','Hope','Irene','Vivian','Catherine','Esther','Mary','Sarah','Lydia','Ruth','Naomi','Beatrice','Cynthia','Purity','Sharon','Janet','Lucy','Nancy','Winnie','Diana','Agnes','Rose','Linda','Angela','Judith','Carol','Patricia'];
const LAST_NAMES   = ['Kamau','Njoroge','Wanjiku','Mwangi','Ochieng','Otieno','Akinyi','Wambua','Mutua','Kiprotich','Kipchoge','Chebet','Ruto','Korir','Langat','Barasa','Wekesa','Simiyu','Namukasa','Omondi','Nyong\'o','Owino','Onyango','Adhiambo','Ndung\'u','Githinji','Gacheru','Waithaka','Kariuki','Njogu'];

function maleName()   { return { firstName: pick(MALE_FIRST),   lastName: pick(LAST_NAMES), gender: 'male' }; }
function femaleName() { return { firstName: pick(FEMALE_FIRST), lastName: pick(LAST_NAMES), gender: 'female' }; }
function studentName() { return Math.random() > 0.5 ? maleName() : femaleName(); }

const PHONE_PREFIXES = ['0712','0722','0733','0740','0756','0768','0790','0702','0110','0111'];
function kenyanPhone() { return `${pick(PHONE_PREFIXES)}${String(rand(100000, 999999))}`; }

// ── School Data ───────────────────────────────────────────────────────────────
const SCHOOL_1 = {
  name: 'Joyful Primary School',
  email: 'info@joyfulprimary.ac.ke',
  phone: '+254712305042',
  county: 'Nairobi',
  registrationNumber: 'NRB/PRI/2009/0341',
  address: 'P.O. Box 4413-00100, Westlands, Nairobi',
};

const SCHOOL_2 = {
  name: 'Hilltop Academy',
  email: 'admin@hilltopacademy.ac.ke',
  phone: '+254733891200',
  county: 'Nakuru',
  registrationNumber: 'NKR/PRI/2012/0187',
  address: 'P.O. Box 782-20100, Milimani, Nakuru',
};

const SETTINGS_1 = {
  currentAcademicYear: '2025',
  motto: 'Faith, Excellence & Service',
  principalName: 'Mr. John Mwangi Kamau',
  physicalAddress: 'Off Westlands Road, Nairobi',
  terms: [
    { name: 'Term 1', startDate: new Date('2025-01-06'), endDate: new Date('2025-04-04') },
    { name: 'Term 2', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-25') },
    { name: 'Term 3', startDate: new Date('2025-09-01'), endDate: new Date('2025-11-28') },
  ],
  holidays: [
    { name: 'New Year Holiday', date: new Date('2025-01-01'), description: 'New Year national holiday' },
    { name: 'Good Friday', date: new Date('2025-04-18'), description: 'Easter break begins' },
    { name: 'Labour Day', date: new Date('2025-05-01'), description: 'Workers\' Day' },
    { name: 'Madaraka Day', date: new Date('2025-06-01'), description: 'Self-Governance Day' },
    { name: 'Huduma Day', date: new Date('2025-10-10'), description: 'National Service Day' },
    { name: 'Mashujaa Day', date: new Date('2025-10-20'), description: 'Heroes Day' },
    { name: 'Jamhuri Day', date: new Date('2025-12-12'), description: 'Independence Day' },
    { name: 'Christmas Day', date: new Date('2025-12-25'), description: 'Christmas Holiday' },
    { name: 'Boxing Day', date: new Date('2025-12-26'), description: 'Public Holiday' },
  ],
};

const SETTINGS_2 = {
  currentAcademicYear: '2025',
  motto: 'Aspire to Inspire',
  principalName: 'Mrs. Sarah Wanjiru Ndung\'u',
  physicalAddress: 'Milimani Estate, Nakuru',
  terms: [
    { name: 'Term 1', startDate: new Date('2025-01-06'), endDate: new Date('2025-04-04') },
    { name: 'Term 2', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-25') },
    { name: 'Term 3', startDate: new Date('2025-09-01'), endDate: new Date('2025-11-28') },
  ],
  holidays: [
    { name: 'New Year Holiday', date: new Date('2025-01-01') },
    { name: 'Madaraka Day', date: new Date('2025-06-01') },
    { name: 'Mashujaa Day', date: new Date('2025-10-20') },
    { name: 'Jamhuri Day', date: new Date('2025-12-12') },
    { name: 'Christmas Day', date: new Date('2025-12-25') },
  ],
};

// ── Subject definitions by level ──────────────────────────────────────────────
const LOWER_PRIMARY_SUBJECTS = [
  { name: 'English / Literacy',   code: 'ENG', department: 'Languages' },
  { name: 'Kiswahili',            code: 'KIS', department: 'Languages' },
  { name: 'Mathematics',          code: 'MAT', department: 'Mathematics' },
  { name: 'Environmental Activities', code: 'ENV', department: 'Sciences' },
  { name: 'Creative Arts & Sports',   code: 'CAS', department: 'Arts & Sports' },
  { name: 'Religious Education',      code: 'CRE', department: 'Humanities' },
];

const UPPER_PRIMARY_SUBJECTS = [
  { name: 'English',              code: 'ENG', department: 'Languages' },
  { name: 'Kiswahili',            code: 'KIS', department: 'Languages' },
  { name: 'Mathematics',          code: 'MAT', department: 'Mathematics' },
  { name: 'Science & Technology', code: 'SCI', department: 'Sciences' },
  { name: 'Social Studies',       code: 'SST', department: 'Humanities' },
  { name: 'Creative Arts & Sports', code: 'CAS', department: 'Arts & Sports' },
  { name: 'Religious Education',    code: 'CRE', department: 'Humanities' },
  { name: 'Home Science',           code: 'HOM', department: 'Practical' },
];

const JUNIOR_SECONDARY_SUBJECTS = [
  { name: 'English',             code: 'ENG', department: 'Languages' },
  { name: 'Kiswahili',           code: 'KIS', department: 'Languages' },
  { name: 'Mathematics',         code: 'MAT', department: 'Mathematics' },
  { name: 'Integrated Science',  code: 'ISC', department: 'Sciences' },
  { name: 'Social Studies',      code: 'SST', department: 'Humanities' },
  { name: 'Business Studies',    code: 'BST', department: 'Business' },
  { name: 'Agriculture',         code: 'AGR', department: 'Practical' },
  { name: 'Home Science',        code: 'HOM', department: 'Practical' },
  { name: 'Religious Education', code: 'CRE', department: 'Humanities' },
  { name: 'Creative Arts & Sports', code: 'CAS', department: 'Arts & Sports' },
  { name: 'Pre-Technical Studies',  code: 'PTS', department: 'Technical' },
];

function subjectsForLevel(level) {
  if (level === 'Lower Primary')    return LOWER_PRIMARY_SUBJECTS;
  if (level === 'Upper Primary')    return UPPER_PRIMARY_SUBJECTS;
  if (level === 'Junior Secondary') return JUNIOR_SECONDARY_SUBJECTS;
  return LOWER_PRIMARY_SUBJECTS;
}

// ── Fee schedule by level ─────────────────────────────────────────────────────
function feeItemsForLevel(level) {
  if (level === 'Lower Primary') return [
    { name: 'Tuition Fee',       amount: 8000 },
    { name: 'Activity Fee',      amount: 1500 },
    { name: 'Lunch / Meals',     amount: 4000 },
    { name: 'Stationery',        amount: 800 },
  ];
  if (level === 'Upper Primary') return [
    { name: 'Tuition Fee',       amount: 10000 },
    { name: 'Activity Fee',      amount: 2000 },
    { name: 'Lunch / Meals',     amount: 4000 },
    { name: 'Stationery',        amount: 1000 },
  ];
  if (level === 'Junior Secondary') return [
    { name: 'Tuition Fee',       amount: 12000 },
    { name: 'Activity Fee',      amount: 2500 },
    { name: 'Lunch / Meals',     amount: 4500 },
    { name: 'Stationery',        amount: 1200 },
    { name: 'Exam Fee',          amount: 500 },
  ];
  return [{ name: 'Tuition Fee', amount: 8000 }];
}

// ── Class definitions ─────────────────────────────────────────────────────────
const CLASSES_SCHOOL_1 = [
  { name: 'Grade 1', stream: 'East',  levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 1', stream: 'West',  levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 2', stream: 'Blue',  levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 3', stream: 'North', levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 4', stream: 'A',     levelCategory: 'Upper Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 6', stream: 'A',     levelCategory: 'Upper Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 7', stream: 'A',     levelCategory: 'Junior Secondary', academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 9', stream: 'A',     levelCategory: 'Junior Secondary', academicYear: '2025', term: 'Term 1' },
];

const CLASSES_SCHOOL_2 = [
  { name: 'Grade 1', stream: null, levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 2', stream: null, levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 3', stream: null, levelCategory: 'Lower Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 5', stream: null, levelCategory: 'Upper Primary',    academicYear: '2025', term: 'Term 1' },
  { name: 'Grade 8', stream: null, levelCategory: 'Junior Secondary', academicYear: '2025', term: 'Term 1' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const RESET = process.argv.includes('--reset');
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGO_URI not set in .env');

  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected');

  if (RESET) {
    console.log('🗑️  Dropping collections…');
    const cols = [School, User, Class, Student, Subject, Exam, Result, FeeStructure, Payment, Attendance, SchoolSettings];
    for (const M of cols) {
      await M.deleteMany({}).catch(() => {});
    }
    console.log('✅ Cleared');
  }

  // ── 1. Superadmin ──────────────────────────────────────────────────────────
  console.log('\n👤 Creating superadmin…');
  const superadmin = await User.findOneAndUpdate(
    { email: 'superadmin@diraschool.com' },
    {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@diraschool.com',
      password: await hash('SuperAdmin@2025'),
      role: 'superadmin',
      emailVerified: true,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`  superadmin@diraschool.com  /  SuperAdmin@2025`);

  // ── 2. Schools ─────────────────────────────────────────────────────────────
  console.log('\n🏫 Creating schools…');
  const school1 = await School.findOneAndUpdate(
    { email: SCHOOL_1.email },
    { ...SCHOOL_1, subscriptionStatus: 'active', planTier: 'premium', isActive: true,
      trialExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const school2 = await School.findOneAndUpdate(
    { email: SCHOOL_2.email },
    { ...SCHOOL_2, subscriptionStatus: 'active', planTier: 'standard', isActive: true,
      trialExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`  ✔ ${school1.name} (${school1._id})`);
  console.log(`  ✔ ${school2.name} (${school2._id})`);

  // ── 3. School settings ─────────────────────────────────────────────────────
  console.log('\n⚙️  School settings…');
  await SchoolSettings.findOneAndUpdate(
    { schoolId: school1._id },
    { schoolId: school1._id, ...SETTINGS_1 },
    { upsert: true }
  );
  await SchoolSettings.findOneAndUpdate(
    { schoolId: school2._id },
    { schoolId: school2._id, ...SETTINGS_2 },
    { upsert: true }
  );

  // ── 4. Admin users ─────────────────────────────────────────────────────────
  console.log('\n👤 Creating admin & staff users…');

  async function upsertUser(data) {
    const existing = await User.findOne({ schoolId: data.schoolId, email: data.email });
    if (existing) return existing;
    return User.create(data); // triggers bcrypt pre-save hook
  }

  const admin1 = await upsertUser({
    firstName: 'John', lastName: 'Kamau', email: 'admin@joyfulprimary.ac.ke',
    phone: kenyanPhone(), password: 'Admin@2025!', role: 'school_admin',
    schoolId: school1._id, emailVerified: true, isActive: true,
  });
  const deputy1 = await upsertUser({
    firstName: 'Alice', lastName: 'Njoroge', email: 'deputy@joyfulprimary.ac.ke',
    phone: kenyanPhone(), password: 'Staff@2025!', role: 'deputy_headteacher',
    schoolId: school1._id, emailVerified: true, isActive: true,
  });
  const secretary1 = await upsertUser({
    firstName: 'Grace', lastName: 'Wanjiku', email: 'secretary@joyfulprimary.ac.ke',
    phone: kenyanPhone(), password: 'Staff@2025!', role: 'secretary',
    schoolId: school1._id, emailVerified: true, isActive: true,
  });
  const accountant1 = await upsertUser({
    firstName: 'Peter', lastName: 'Ochieng', email: 'accounts@joyfulprimary.ac.ke',
    phone: kenyanPhone(), password: 'Staff@2025!', role: 'accountant',
    schoolId: school1._id, emailVerified: true, isActive: true,
  });

  const admin2 = await upsertUser({
    firstName: 'Sarah', lastName: 'Ndung\'u', email: 'admin@hilltopacademy.ac.ke',
    phone: kenyanPhone(), password: 'Admin@2025!', role: 'school_admin',
    schoolId: school2._id, emailVerified: true, isActive: true,
  });
  const secretary2 = await upsertUser({
    firstName: 'Brian', lastName: 'Otieno', email: 'secretary@hilltopacademy.ac.ke',
    phone: kenyanPhone(), password: 'Staff@2025!', role: 'secretary',
    schoolId: school2._id, emailVerified: true, isActive: true,
  });

  console.log('  ✔ admin@joyfulprimary.ac.ke  / Admin@2025!');
  console.log('  ✔ admin@hilltopacademy.ac.ke / Admin@2025!');
  console.log('  ✔ All staff passwords: Staff@2025!');

  // ── 5. Classes (without classTeacherId yet) ────────────────────────────────
  console.log('\n📚 Creating classes…');

  async function upsertClass(schoolId, cls) {
    return Class.findOneAndUpdate(
      { schoolId, name: cls.name, stream: cls.stream ?? null, academicYear: cls.academicYear, term: cls.term },
      { schoolId, ...cls },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const classes1 = await Promise.all(CLASSES_SCHOOL_1.map((c) => upsertClass(school1._id, c)));
  const classes2 = await Promise.all(CLASSES_SCHOOL_2.map((c) => upsertClass(school2._id, c)));

  console.log(`  ✔ ${classes1.length} classes for ${school1.name}`);
  console.log(`  ✔ ${classes2.length} classes for ${school2.name}`);

  // ── 6. Teachers ────────────────────────────────────────────────────────────
  console.log('\n👩‍🏫 Creating teachers…');

  const teacherDefs1 = [
    { firstName: 'Beatrice', lastName: 'Akinyi',    email: 'beatrice@joyfulprimary.ac.ke',  tscNumber: 'TSC-00123451', classIdx: 0 },
    { firstName: 'Samuel',   lastName: 'Mutua',     email: 'samuel@joyfulprimary.ac.ke',    tscNumber: 'TSC-00123452', classIdx: 1 },
    { firstName: 'Lydia',    lastName: 'Chebet',    email: 'lydia@joyfulprimary.ac.ke',     tscNumber: 'TSC-00123453', classIdx: 2 },
    { firstName: 'Victor',   lastName: 'Korir',     email: 'victor@joyfulprimary.ac.ke',    tscNumber: 'TSC-00123454', classIdx: 3 },
    { firstName: 'Mercy',    lastName: 'Wambua',    email: 'mercy@joyfulprimary.ac.ke',     tscNumber: 'TSC-00123455', classIdx: 4 },
    { firstName: 'Eric',     lastName: 'Barasa',    email: 'eric@joyfulprimary.ac.ke',      tscNumber: 'TSC-00123456', classIdx: 5 },
    { firstName: 'Irene',    lastName: 'Ruto',      email: 'irene@joyfulprimary.ac.ke',     tscNumber: 'TSC-00123457', classIdx: 6 },
    { firstName: 'Daniel',   lastName: 'Langat',    email: 'daniel@joyfulprimary.ac.ke',    tscNumber: 'TSC-00123458', classIdx: 7 },
  ];

  const teacherDefs2 = [
    { firstName: 'Faith',    lastName: 'Omondi',    email: 'faith@hilltopacademy.ac.ke',    tscNumber: 'TSC-00223451', classIdx: 0 },
    { firstName: 'Kevin',    lastName: 'Simiyu',    email: 'kevin@hilltopacademy.ac.ke',    tscNumber: 'TSC-00223452', classIdx: 1 },
    { firstName: 'Agnes',    lastName: 'Kipchoge',  email: 'agnes@hilltopacademy.ac.ke',    tscNumber: 'TSC-00223453', classIdx: 2 },
    { firstName: 'Moses',    lastName: 'Owino',     email: 'moses@hilltopacademy.ac.ke',    tscNumber: 'TSC-00223454', classIdx: 3 },
    { firstName: 'Joy',      lastName: 'Adhiambo',  email: 'joy@hilltopacademy.ac.ke',      tscNumber: 'TSC-00223455', classIdx: 4 },
  ];

  async function createTeachers(defs, schoolId, classList) {
    const teachers = [];
    for (const def of defs) {
      const cls = classList[def.classIdx];
      const t = await upsertUser({
        firstName: def.firstName, lastName: def.lastName, email: def.email,
        phone: kenyanPhone(), password: 'Teacher@2025!',
        role: 'teacher', schoolId, emailVerified: true, isActive: true,
        tscNumber: def.tscNumber, classId: cls._id,
      });
      await Class.findByIdAndUpdate(cls._id, { classTeacherId: t._id });
      teachers.push(t);
    }
    return teachers;
  }

  const teachers1 = await createTeachers(teacherDefs1, school1._id, classes1);
  const teachers2 = await createTeachers(teacherDefs2, school2._id, classes2);
  console.log(`  ✔ ${teachers1.length} teachers for ${school1.name}  (password: Teacher@2025!)`);
  console.log(`  ✔ ${teachers2.length} teachers for ${school2.name}  (password: Teacher@2025!)`);

  // ── 7. Students ────────────────────────────────────────────────────────────
  console.log('\n🎓 Enrolling students…');

  // Admission number counters
  const admCounters = { [school1._id]: 1, [school2._id]: 1 };
  function nextAdm(schoolId, prefix) {
    const n = admCounters[schoolId]++;
    return `${prefix}/${String(n).padStart(3, '0')}/2025`;
  }

  // Parent users created alongside students
  const parentUsers = [];

  async function enrollStudents(cls, schoolId, count, prefix, recordingUserId) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const { firstName, lastName, gender } = studentName();
      const admissionNumber = nextAdm(schoolId, prefix);
      const dob = new Date(rand(2010, 2019), rand(0, 11), rand(1, 28));

      // Every 3rd student gets a guardian with email (→ parent portal)
      let guardians = [];
      let parentIds = [];
      const guardianPhone = kenyanPhone();
      const parentEmail = i % 3 === 0
        ? `parent.${firstName.toLowerCase()}.${admissionNumber.replace(/\//g, '').toLowerCase()}@gmail.com`
        : null;

      if (parentEmail) {
        const gFirst = pick(FEMALE_FIRST);
        const gLast = lastName;
        const parent = await upsertUser({
          firstName: gFirst, lastName: gLast,
          email: parentEmail,
          phone: guardianPhone,
          password: 'Parent@2025!',
          role: 'parent',
          schoolId,
          emailVerified: true,
          isActive: true,
          invitePending: false,
          children: [],
        });
        parentUsers.push(parent);
        guardians = [{
          firstName: gFirst, lastName: gLast,
          relationship: pick(['mother', 'father', 'guardian']),
          phone: guardianPhone, email: parentEmail, userId: parent._id,
        }];
        parentIds = [parent._id];
      } else {
        guardians = [{
          firstName: pick([...MALE_FIRST, ...FEMALE_FIRST]),
          lastName,
          relationship: pick(['mother', 'father', 'guardian']),
          phone: guardianPhone,
        }];
      }

      // Skip hook studentCount increment; we'll set it manually
      const student = new Student({
        schoolId, classId: cls._id, admissionNumber,
        firstName, lastName, gender,
        dateOfBirth: dob,
        enrollmentDate: new Date('2025-01-06'),
        guardians, parentIds,
        status: 'active',
        wasNew: false, // prevent post('save') hook from double-counting
      });
      await student.save();

      // Link student to parent user
      if (parentIds.length) {
        await User.findByIdAndUpdate(parentIds[0], { $addToSet: { children: student._id } });
      }

      created.push(student);
    }
    // Update class student count
    await Class.findByIdAndUpdate(cls._id, { studentCount: created.length });
    return created;
  }

  // School 1 — 8–12 students per class
  const studentMap1 = {};
  for (const cls of classes1) {
    const count = rand(8, 12);
    studentMap1[cls._id] = await enrollStudents(cls, school1._id, count, 'JP', admin1._id);
  }

  // School 2 — 6–9 students per class
  const studentMap2 = {};
  for (const cls of classes2) {
    const count = rand(6, 9);
    studentMap2[cls._id] = await enrollStudents(cls, school2._id, count, 'HA', admin2._id);
  }

  const totalS1 = Object.values(studentMap1).reduce((s, a) => s + a.length, 0);
  const totalS2 = Object.values(studentMap2).reduce((s, a) => s + a.length, 0);
  console.log(`  ✔ ${totalS1} students enrolled at ${school1.name}`);
  console.log(`  ✔ ${totalS2} students enrolled at ${school2.name}`);
  console.log(`  ✔ ${parentUsers.length} parent portal accounts created (password: Parent@2025!)`);

  // ── 8. Subjects ────────────────────────────────────────────────────────────
  console.log('\n📖 Creating subjects…');

  const subjectMap = {}; // classId → Subject[]

  async function createSubjects(cls, schoolId, teacherId) {
    const defs = subjectsForLevel(cls.levelCategory);
    const subs = [];
    for (const def of defs) {
      const sub = await Subject.findOneAndUpdate(
        { schoolId, classId: cls._id, name: def.name },
        { schoolId, classId: cls._id, ...def, teacherIds: [teacherId], isActive: true },
        { upsert: true, new: true }
      );
      subs.push(sub);
    }
    subjectMap[cls._id] = subs;
    return subs;
  }

  for (let i = 0; i < classes1.length; i++) {
    await createSubjects(classes1[i], school1._id, teachers1[Math.min(i, teachers1.length - 1)]._id);
  }
  for (let i = 0; i < classes2.length; i++) {
    await createSubjects(classes2[i], school2._id, teachers2[Math.min(i, teachers2.length - 1)]._id);
  }
  const subCount = Object.values(subjectMap).reduce((s, a) => s + a.length, 0);
  console.log(`  ✔ ${subCount} subjects created across all classes`);

  // ── 9. Fee Structures ──────────────────────────────────────────────────────
  console.log('\n💰 Creating fee structures…');

  async function createFeeStructures(cls, schoolId) {
    const items = feeItemsForLevel(cls.levelCategory);
    for (const term of ['Term 1', 'Term 2', 'Term 3']) {
      await FeeStructure.findOneAndUpdate(
        { schoolId, classId: cls._id, academicYear: '2025', term },
        { schoolId, classId: cls._id, academicYear: '2025', term, items },
        { upsert: true, new: true }
      );
    }
  }

  for (const cls of [...classes1, ...classes2]) {
    const schoolId = classes1.includes(cls) ? school1._id : school2._id;
    await createFeeStructures(cls, schoolId);
  }
  console.log(`  ✔ Fee structures created for all classes × 3 terms`);

  // ── 10. Payments ───────────────────────────────────────────────────────────
  console.log('\n💳 Recording payments…');

  const METHODS = ['cash', 'mpesa', 'bank'];
  let payCount = 0;

  async function recordPayments(cls, students, schoolId, recordedBy) {
    const feeStruct = await FeeStructure.findOne({ schoolId, classId: cls._id, academicYear: '2025', term: 'Term 1' });
    if (!feeStruct) return;
    // totalAmount is set by pre-save hook which doesn't run on findOneAndUpdate — compute it manually
    const total = feeStruct.items.reduce((sum, item) => sum + item.amount, 0);

    for (const student of students) {
      // 70% of students have payments
      if (Math.random() > 0.70) continue;

      // Randomise: full pay, partial, or two instalments
      const scenario = rand(1, 3);
      if (scenario === 1) {
        // Full payment
        await Payment.create({
          schoolId, studentId: student._id, classId: cls._id,
          academicYear: '2025', term: 'Term 1',
          amount: total, method: pick(METHODS),
          reference: `REF-${rand(100000, 999999)}`,
          status: 'completed', recordedByUserId: recordedBy,
          notes: 'Full term payment',
        });
        payCount++;
      } else if (scenario === 2) {
        // Partial payment
        const partial = Math.round(total * (rand(40, 80) / 100) / 100) * 100;
        await Payment.create({
          schoolId, studentId: student._id, classId: cls._id,
          academicYear: '2025', term: 'Term 1',
          amount: partial, method: pick(METHODS),
          reference: `REF-${rand(100000, 999999)}`,
          status: 'completed', recordedByUserId: recordedBy,
          notes: 'Partial payment',
        });
        payCount++;
      } else {
        // Two instalments
        const first  = Math.round(total * 0.5 / 100) * 100;
        const second = Math.round(total * 0.3 / 100) * 100;
        for (const [amt, note] of [[first, '1st instalment'], [second, '2nd instalment']]) {
          await Payment.create({
            schoolId, studentId: student._id, classId: cls._id,
            academicYear: '2025', term: 'Term 1',
            amount: amt, method: pick(METHODS),
            reference: `REF-${rand(100000, 999999)}`,
            status: 'completed', recordedByUserId: recordedBy,
            notes: note,
          });
          payCount++;
        }
      }
    }
  }

  for (const cls of classes1) {
    await recordPayments(cls, studentMap1[cls._id] ?? [], school1._id, accountant1._id);
  }
  for (const cls of classes2) {
    await recordPayments(cls, studentMap2[cls._id] ?? [], school2._id, admin2._id);
  }
  console.log(`  ✔ ${payCount} payment records created`);

  // ── 11. Exams & Results ────────────────────────────────────────────────────
  console.log('\n📝 Creating exams and results…');

  let examCount = 0, resultCount = 0;

  async function createExamsAndResults(cls, students, schoolId) {
    const subjects = subjectMap[cls._id] ?? [];
    const isJSS = cls.levelCategory === 'Junior Secondary';
    const totalMarks = isJSS ? 100 : 40;
    const examTypes = [
      { name: 'Opener Exam', type: 'opener' },
      { name: 'Mid-Term Exam', type: 'midterm' },
      { name: 'End-Term Exam', type: 'endterm' },
    ];

    for (const subject of subjects) {
      for (const et of examTypes) {
        const exam = await Exam.findOneAndUpdate(
          { schoolId, classId: cls._id, subjectId: subject._id, name: et.name, term: 'Term 1', academicYear: '2025' },
          {
            schoolId, classId: cls._id, subjectId: subject._id,
            name: et.name, type: et.type,
            term: 'Term 1', academicYear: '2025',
            levelCategory: cls.levelCategory, totalMarks, isPublished: true,
          },
          { upsert: true, new: true }
        );
        examCount++;

        // Results for each student
        for (const student of students) {
          const marks = rand(isJSS ? 20 : 10, totalMarks);
          const percentage = pct(marks, totalMarks);
          const { grade, points } = gradeResult(marks, totalMarks, isJSS);

          await Result.findOneAndUpdate(
            { schoolId, examId: exam._id, studentId: student._id },
            {
              schoolId, examId: exam._id, classId: cls._id,
              subjectId: subject._id, studentId: student._id,
              term: 'Term 1', academicYear: '2025',
              marks, totalMarks, percentage,
              grade, ...(points !== null ? { points } : {}),
            },
            { upsert: true, new: true }
          );
          resultCount++;
        }
      }
    }
  }

  for (const cls of classes1) {
    await createExamsAndResults(cls, studentMap1[cls._id] ?? [], school1._id);
  }
  for (const cls of classes2) {
    await createExamsAndResults(cls, studentMap2[cls._id] ?? [], school2._id);
  }
  console.log(`  ✔ ${examCount} exams created`);
  console.log(`  ✔ ${resultCount} result records created`);

  // ── 12. Attendance ─────────────────────────────────────────────────────────
  console.log('\n📋 Creating attendance registers…');

  const schoolDates = lastWeekdays(10);
  let regCount = 0;

  const STATUS_WEIGHTS = ['present','present','present','present','present','present','late','excused','absent'];

  async function createAttendance(cls, students, schoolId, takenBy) {
    for (const date of schoolDates) {
      const exists = await Attendance.findOne({ schoolId, classId: cls._id, date });
      if (exists) continue;

      const entries = students.map((s) => ({
        studentId: s._id,
        status: pick(STATUS_WEIGHTS),
      }));

      await Attendance.create({
        schoolId, classId: cls._id, date,
        academicYear: '2025', term: 'Term 1',
        takenByUserId: takenBy._id, isSubstitute: false,
        entries, status: 'submitted',
        submittedAt: new Date(date.getTime() + 2 * 60 * 60 * 1000),
      });
      regCount++;
    }
  }

  for (let i = 0; i < classes1.length; i++) {
    const teacher = teachers1[Math.min(i, teachers1.length - 1)];
    await createAttendance(classes1[i], studentMap1[classes1[i]._id] ?? [], school1._id, teacher);
  }
  for (let i = 0; i < classes2.length; i++) {
    const teacher = teachers2[Math.min(i, teachers2.length - 1)];
    await createAttendance(classes2[i], studentMap2[classes2[i]._id] ?? [], school2._id, teacher);
  }
  console.log(`  ✔ ${regCount} attendance registers created (last 10 school days)`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(56));
  console.log('✅  SEED COMPLETE');
  console.log('═'.repeat(56));
  console.log(`
  SUPERADMIN
    Email:    superadmin@diraschool.com
    Password: SuperAdmin@2025

  SCHOOL 1 — ${school1.name}
    Admin:    admin@joyfulprimary.ac.ke   /  Admin@2025!
    Staff:    deputy, secretary, accounts  /  Staff@2025!
    Teachers: beatrice, samuel, lydia…    /  Teacher@2025!
    Classes:  ${classes1.length}   Students: ${totalS1}

  SCHOOL 2 — ${school2.name}
    Admin:    admin@hilltopacademy.ac.ke  /  Admin@2025!
    Staff:    secretary                    /  Staff@2025!
    Teachers: faith, kevin, agnes…        /  Teacher@2025!
    Classes:  ${classes2.length}   Students: ${totalS2}

  PARENTS (every 3rd student has a portal account)
    Password: Parent@2025!
`);

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
