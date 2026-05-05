// Tour step definitions per role.
// Selectors use data-tour attributes: [data-tour="xxx"]
// Buttons use `this` which Shepherd binds to the tour instance.

function makeStepButtons({ isFirst, isLast }) {
  const buttons = [];
  if (!isFirst) {
    buttons.push({ label: 'Back', action() { this.back(); }, classes: 'tour-btn-secondary' });
  }
  buttons.push({ label: 'Skip tour', action() { this.cancel(); }, classes: 'tour-btn-skip' });
  buttons.push({
    label: isLast ? 'Done ✓' : 'Next →',
    action() { isLast ? this.complete() : this.next(); },
    classes: 'tour-btn-primary',
  });
  return buttons;
}

function buildSteps(rawSteps) {
  return rawSteps.map((step, i) => ({
    ...step,
    buttons: makeStepButtons({ isFirst: i === 0, isLast: i === rawSteps.length - 1 }),
    _stepNumber: i + 1,
    _totalSteps: rawSteps.length,
  }));
}

// ── School Admin Tour (10 steps) ──────────────────────────────────────────────
const schoolAdminSteps = buildSteps([
  {
    id: 'admin-1',
    attachTo: { element: '[data-tour="dashboard-header"]', on: 'bottom' },
    title: 'Welcome to Diraschool',
    text: 'This is your school management dashboard. Everything you need to run your school is accessible from here. Let us take 2 minutes to show you around.',
  },
  {
    id: 'admin-2',
    attachTo: { element: '[data-tour="setup-checklist"]', on: 'bottom' },
    title: 'Complete Your School Setup',
    text: 'Start here. Add your school details, import your students, and connect M-Pesa to go fully live. The checklist tracks your progress.',
  },
  {
    id: 'admin-3',
    attachTo: { element: '[data-tour="staff-nav-item"]', on: 'right' },
    title: 'Manage Your Staff',
    text: 'Add teachers and staff, manage their profiles, track leave requests, and run payroll from this section.',
  },
  {
    id: 'admin-4',
    attachTo: { element: '[data-tour="students-nav-item"]', on: 'right' },
    title: 'Student Records',
    text: 'All student profiles, admission records, and academic history live here. Import students in bulk using our Excel template.',
  },
  {
    id: 'admin-5',
    attachTo: { element: '[data-tour="finance-nav"]', on: 'right' },
    title: 'Fee Collection',
    text: 'Once M-Pesa is connected, all parent payments are recorded here automatically. No manual reconciliation needed.',
  },
  {
    id: 'admin-6',
    attachTo: { element: '[data-tour="mpesa-setup-card"]', on: 'bottom' },
    title: 'Connect M-Pesa',
    text: 'Connect your school Paybill number here. Parents pay as they normally would and the system records everything automatically.',
  },
  {
    id: 'admin-7',
    attachTo: { element: '[data-tour="geofence-settings"]', on: 'bottom' },
    title: 'Set Your School Boundary',
    text: 'Draw your school boundary on the map. Staff can only check in when they are physically on school premises.',
  },
  {
    id: 'admin-8',
    attachTo: { element: '[data-tour="users-nav-item"]', on: 'right' },
    title: 'Create Staff Accounts',
    text: 'Create login accounts for your principal, finance officer, secretary, and teachers. Each role sees only what is relevant to their work.',
  },
  {
    id: 'admin-9',
    attachTo: { element: '[data-tour="settings-nav-item"]', on: 'right' },
    title: 'Reports and Settings',
    text: 'Manage your school settings, academic years, and terms. Fees reports and staff attendance summaries are available in each section.',
  },
  {
    id: 'admin-10',
    attachTo: { element: '[data-tour="help-menu"]', on: 'bottom' },
    title: 'Need Help?',
    text: 'Access guides, contact support, or restart this tour anytime from the help menu. We are always available to assist you.',
  },
]);

// ── Principal / Headteacher Tour (7 steps) ────────────────────────────────────
const principalSteps = buildSteps([
  {
    id: 'principal-1',
    attachTo: { element: '[data-tour="dashboard-header"]', on: 'bottom' },
    title: 'Your School at a Glance',
    text: 'This dashboard shows you the health of your school in real time. No more walking around to take attendance — it is all here.',
  },
  {
    id: 'principal-2',
    attachTo: { element: '[data-tour="staff-attendance-widget"]', on: 'bottom' },
    title: 'Who is Here Today',
    text: 'See which teachers have checked in, who is late, and who is absent — updated in real time as staff arrive each morning.',
  },
  {
    id: 'principal-3',
    attachTo: { element: '[data-tour="student-attendance-widget"]', on: 'bottom' },
    title: 'Student Attendance',
    text: 'Overall attendance rate across all classes today. Click any class to see the full register.',
  },
  {
    id: 'principal-4',
    attachTo: { element: '[data-tour="fee-health-widget"]', on: 'bottom' },
    title: 'Fee Collection Status',
    text: 'A quick view of how much of this term\'s fees have been collected. The full breakdown is in the finance section.',
  },
  {
    id: 'principal-5',
    attachTo: { element: '[data-tour="academic-widget"]', on: 'bottom' },
    title: 'Academic Overview',
    text: 'Class-by-class performance summary based on the latest assessments entered by teachers.',
  },
  {
    id: 'principal-6',
    attachTo: { element: '[data-tour="pending-actions-widget"]', on: 'bottom' },
    title: 'Things Needing Your Attention',
    text: 'Leave requests, new admissions pending approval, and other items that need your decision appear here.',
  },
  {
    id: 'principal-7',
    attachTo: { element: '[data-tour="checkin-widget"]', on: 'bottom' },
    title: 'Live Check-In Status',
    text: 'See a real-time view of staff check-ins against your school geofence boundary.',
  },
]);

// ── Finance / Accountant Tour (8 steps) ───────────────────────────────────────
const financeSteps = buildSteps([
  {
    id: 'finance-1',
    attachTo: { element: '[data-tour="finance-dashboard"]', on: 'bottom' },
    title: 'Your Finance Dashboard',
    text: 'Everything money-related is here. M-Pesa payments are recorded automatically — no more manual statement reconciliation.',
  },
  {
    id: 'finance-2',
    attachTo: { element: '[data-tour="todays-collections"]', on: 'bottom' },
    title: "Today's Payments",
    text: 'Every M-Pesa payment received today appears here in real time, matched to the correct student automatically.',
  },
  {
    id: 'finance-3',
    attachTo: { element: '[data-tour="fee-balances-widget"]', on: 'bottom' },
    title: 'Outstanding Balances',
    text: 'See which students have outstanding fees, sorted by amount owed. Send bulk SMS reminders to parents directly from here.',
  },
  {
    id: 'finance-4',
    attachTo: { element: '[data-tour="unallocated-payments"]', on: 'bottom' },
    title: 'Payments Needing Attention',
    text: 'If a parent enters the wrong admission number, the payment lands here. Search for the correct student and allocate it manually.',
  },
  {
    id: 'finance-5',
    attachTo: { element: '[data-tour="fee-structure-nav"]', on: 'bottom' },
    title: 'Set Up Fee Structure',
    text: 'Define how much each class pays per term. You can set different amounts per level and add optional charges.',
  },
  {
    id: 'finance-6',
    attachTo: { element: '[data-tour="payroll-nav-item"]', on: 'right' },
    title: 'Track School Expenses',
    text: 'Log school expenditures and payroll here. Track spending against your budget for each department.',
  },
  {
    id: 'finance-7',
    attachTo: { element: '[data-tour="finance-reports"]', on: 'bottom' },
    title: 'Financial Reports',
    text: 'Generate term-end collection reports, defaulter lists, and income summaries — exportable to PDF or Excel.',
  },
  {
    id: 'finance-8',
    attachTo: { element: '[data-tour="help-menu"]', on: 'bottom' },
    title: 'Need Help?',
    text: 'Access guides, contact support, or restart this tour anytime from the help menu at the top right.',
  },
]);

// ── Secretary Tour (7 steps) ──────────────────────────────────────────────────
const secretarySteps = buildSteps([
  {
    id: 'secretary-1',
    attachTo: { element: '[data-tour="dashboard-header"]', on: 'bottom' },
    title: 'Your Operations Dashboard',
    text: 'You are the operational hub of the school. Everything from admissions to parent communication is managed from here.',
  },
  {
    id: 'secretary-2',
    attachTo: { element: '[data-tour="students-nav-item"]', on: 'right' },
    title: 'Pending Admissions',
    text: 'New student applications are processed here. Register students, assign admission numbers, and allocate classes.',
  },
  {
    id: 'secretary-3',
    attachTo: { element: '[data-tour="student-attendance-widget"]', on: 'bottom' },
    title: "Today's Attendance",
    text: 'School-wide attendance summary updated as class teachers mark registers. Classes not yet marked are highlighted.',
  },
  {
    id: 'secretary-4',
    attachTo: { element: '[data-tour="messaging-nav-item"]', on: 'right' },
    title: 'Message Parents',
    text: 'Send SMS or email to individual parents, a whole class, or the entire school. All messages are logged automatically.',
  },
  {
    id: 'secretary-5',
    attachTo: { element: '[data-tour="staff-nav-item"]', on: 'right' },
    title: 'Staff Records',
    text: 'Maintain staff profiles, process leave requests, and track contract renewal dates.',
  },
  {
    id: 'secretary-6',
    attachTo: { element: '[data-tour="timetable-nav-item"]', on: 'right' },
    title: 'School Calendar',
    text: 'Manage the school timetable, exam dates, events, and holidays. Changes notify relevant staff automatically.',
  },
  {
    id: 'secretary-7',
    attachTo: { element: '[data-tour="help-menu"]', on: 'bottom' },
    title: 'Need Help?',
    text: 'Access guides, contact support, or restart this tour anytime from the help menu at the top right.',
  },
]);

// ── Teacher Tour (6 steps) ────────────────────────────────────────────────────
const teacherSteps = buildSteps([
  {
    id: 'teacher-1',
    attachTo: { element: '[data-tour="dashboard-header"]', on: 'bottom' },
    title: 'Your Teaching Dashboard',
    text: 'Everything you need for your classes is here. Mark attendance, enter grades, and communicate with parents — all in one place.',
  },
  {
    id: 'teacher-2',
    attachTo: { element: '[data-tour="timetable-widget"]', on: 'bottom' },
    title: 'Your Classes Today',
    text: 'Your teaching schedule for today. Click any class to go directly to the attendance register or gradebook.',
  },
  {
    id: 'teacher-3',
    attachTo: { element: '[data-tour="attendance-nav-item"]', on: 'right' },
    title: 'Mark Class Attendance',
    text: 'Mark student attendance for each lesson. Parents of absent students are notified automatically via SMS.',
  },
  {
    id: 'teacher-4',
    attachTo: { element: '[data-tour="exams-nav-item"]', on: 'right' },
    title: 'Enter Grades and Assessments',
    text: 'Enter marks and CBC assessment scores for your students. The system calculates averages and generates report cards.',
  },
  {
    id: 'teacher-5',
    attachTo: { element: '[data-tour="checkin-button"]', on: 'bottom' },
    title: 'Your Daily Check-In',
    text: 'Tap here every morning to check in. Your location is verified automatically — you must be on school premises. Takes less than 10 seconds.',
  },
  {
    id: 'teacher-6',
    attachTo: { element: '[data-tour="leave-nav-item"]', on: 'right' },
    title: 'Apply for Leave',
    text: 'Submit leave requests here. You will be notified when your request is approved or declined by the principal.',
  },
]);

// ── Director Tour (same as principal) ─────────────────────────────────────────
const directorSteps = principalSteps;

// ── Role → steps map ──────────────────────────────────────────────────────────
export const TOUR_STEPS_BY_ROLE = {
  school_admin:        schoolAdminSteps,
  director:            directorSteps,
  headteacher:         principalSteps,
  deputy_headteacher:  principalSteps,
  accountant:          financeSteps,
  secretary:           secretarySteps,
  teacher:             teacherSteps,
  department_head:     teacherSteps,
};

export function getTourStepsForRole(role) {
  return TOUR_STEPS_BY_ROLE[role] ?? null;
}
