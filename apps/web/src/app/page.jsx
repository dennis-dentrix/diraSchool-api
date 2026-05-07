import Link from 'next/link';
import {
  ArrowRight, Check, Users, GraduationCap, CreditCard,
  ClipboardCheck, FileText, BookOpen, Bus,
  Smartphone, Zap, X, ChevronRight,
} from 'lucide-react';
import LandingFAQ from './_components/LandingFAQ';

export const metadata = {
  title: 'DiraSchool — CBC School Management System for Kenyan Schools',
  description:
    'Run your CBC school without the paperwork. DiraSchool handles attendance, CBC report cards, fee management, and the parent portal — built for Kenyan schools.',
  alternates: { canonical: 'https://diraschool.com' },
  openGraph: {
    title: 'DiraSchool — Run Your School Without the Paperwork',
    description:
      'The complete CBC school management platform for Kenya. Digital attendance, automated fees, one-click report cards, and a parent portal. Start free for 30 days.',
    url: 'https://diraschool.com',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://diraschool.com/#org',
      name: 'DiraSchool',
      url: 'https://diraschool.com',
      logo: 'https://diraschool.com/icon.svg',
      description: 'CBC school management system for Kenyan schools.',
      address: { '@type': 'PostalAddress', addressCountry: 'KE' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://diraschool.com/#app',
      name: 'DiraSchool',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: 'https://diraschool.com',
      publisher: { '@id': 'https://diraschool.com/#org' },
      description:
        'Complete CBC school management system for Kenyan schools including attendance, report cards, fee management, and parent portal.',
      offers: {
        '@type': 'Offer',
        price: '10000',
        priceCurrency: 'KES',
        description: 'Base fee per term plus KES 40 per enrolled student',
      },
      featureList: [
        'CBC Report Card Generation',
        'Digital Attendance Tracking',
        'Fee Management',
        'Parent Portal',
        'Staff Management',
        'Timetable Management',
        'Transport Management',
      ],
    },
  ],
};

// ── Nav ────────────────────────────────────────────────────────────────────────
function MarketingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Diraschool</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all duration-150 active:scale-[0.98]"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-20 pb-28 px-4 sm:px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-64 bg-blue-800/10 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8 tracking-wide">
          <Zap className="h-3 w-3" />
          Built for Kenyan CBC Schools
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05]">
          Less paperwork.<br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Better schools.
          </span>
        </h1>

        <p className="mt-7 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          DiraSchool replaces your register books, fee ledgers, and typed report cards with one
          digital system — so your team spends less time on admin and more time on education.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-2xl shadow-blue-500/30 transition-all duration-150 active:scale-[0.98] text-base"
          >
            Start free — 30 days <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/8 hover:text-white transition-all duration-150 text-base font-medium"
          >
            See pricing <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-600 tracking-wide">
          Full access · 50 students during trial · No credit card required
        </p>

        <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
          {[
            'CBC-compliant report cards',
            'All 7 learning areas',
            'KES pricing, Kenyan calendar',
            'HTTPS + data encryption',
            'Cancel any time',
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />{t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Paperwork section ──────────────────────────────────────────────────────────
function PaperworkSection() {
  const replacements = [
    {
      before: '3 teachers, 3 days to type report cards',
      after: 'Click Generate. 40 CBC report cards in under 2 minutes.',
      icon: FileText,
    },
    {
      before: 'Excel fee ledger with broken formulas and missing payments',
      after: 'Automated fee tracking, printed receipts, and M-Pesa integration.',
      icon: CreditCard,
    },
    {
      before: 'Paper attendance registers that get lost or damaged',
      after: 'Digital register on any phone. Class reports in one click.',
      icon: ClipboardCheck,
    },
    {
      before: 'WhatsApp groups for results, fees, and school notices',
      after: 'Parent portal with real-time results, balances, and updates.',
      icon: Smartphone,
    },
  ];

  return (
    <section className="bg-slate-950 py-24 px-4 sm:px-6 border-t border-white/8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">The paperwork problem</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
            Your admin team loses 40+ hours<br className="hidden sm:block" /> every single term to paperwork
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Every Kenyan school we spoke to described the same end-of-term nightmare: register books
            everywhere, fee chases on WhatsApp, and teachers typing the same report card 40 times.
            DiraSchool was built to end that.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-px rounded-xl border border-white/10 bg-white/10 overflow-hidden mb-12">
          {[
            { n: '40+', label: 'hours saved per term' },
            { n: '2 min', label: 'to generate class report cards' },
            { n: '0', label: 'paper registers needed' },
          ].map(({ n, label }) => (
            <div key={label} className="bg-slate-950 py-8 text-center">
              <p className="text-4xl font-black text-white">{n}</p>
              <p className="text-xs text-slate-400 mt-2 max-w-[120px] mx-auto leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Before / After grid */}
        <div className="grid sm:grid-cols-2 gap-3">
          {replacements.map(({ before, after, icon: Icon }) => (
            <div key={before} className="rounded-xl border border-white/8 bg-white/3 p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <X className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-slate-500 text-sm">{before}</p>
              </div>
              <div className="h-px bg-white/8" />
              <div className="flex items-start gap-2.5">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-slate-200 text-sm font-medium">{after}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all text-sm"
          >
            Start eliminating paperwork today <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: FileText,
    title: 'CBC Report Cards',
    desc: 'Generate complete CBC report cards for any class in seconds. All 7 learning areas, grade descriptors, teacher remarks — print-ready.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: ClipboardCheck,
    title: 'Digital Attendance',
    desc: 'Teachers take register on any device. Class-level and student-level reports, late arrival tracking, and parent alerts built in.',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: CreditCard,
    title: 'Fee Management',
    desc: 'Per-student fee structures, payment recording, balance tracking, and receipt generation. Designed around Kenyan school term billing.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Smartphone,
    title: 'Parent Portal',
    desc: 'Parents log in to see attendance, results, fee balances, and school updates in real time — no WhatsApp groups needed.',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    icon: Users,
    title: 'Staff Management',
    desc: 'Invite staff by email with role-based permissions. School admin, headteacher, teachers, accountants — each sees only what they need.',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    icon: GraduationCap,
    title: 'Student Records',
    desc: 'Complete learner profiles: guardian contacts, admission history, class transfers, exam results, and CBC report card archive.',
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    icon: BookOpen,
    title: 'Exams & Results',
    desc: 'Create exams, enter scores in bulk, and auto-generate grade summaries. Results feed directly into CBC report card generation.',
    color: 'text-rose-600 bg-rose-50',
  },
  {
    icon: Bus,
    title: 'Transport',
    desc: 'Assign students to transport routes, manage pickups, and keep route operations visible to the school office.',
    color: 'text-amber-600 bg-amber-50',
  },
];

function Features() {
  return (
    <section className="bg-slate-50 py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything your school needs
          </h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            One platform. All modules. No add-ons to unlock — every school gets the full system.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────────
function Testimonials() {
  const quotes = [
    {
      body: "End of term used to take our secretarial staff three full days just for report cards. Now the class teacher clicks a button and they're done before lunch.",
      name: 'Head Teacher',
      school: 'Primary school, Nairobi County',
    },
    {
      body: "We were tracking fees on a shared Excel sheet. Balances were always wrong. DiraSchool gives every parent their own portal and the numbers are always right.",
      name: 'School Bursar',
      school: 'Academy, Kiambu County',
    },
    {
      body: "Parents used to call the office asking for results. Now they check the portal themselves. It's cut our admin calls by more than half.",
      name: 'Deputy Principal',
      school: 'Secondary school, Mombasa',
    },
  ];

  return (
    <section className="bg-white py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">From Kenyan schools</p>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">What school leaders are saying</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map(({ body, name, school }) => (
            <div key={name} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-7 space-y-4">
              <svg className="h-5 w-5 text-blue-300" fill="currentColor" viewBox="0 0 32 32">
                <path d="M10 8C6.1 8 3 11.1 3 15v9h9v-9H6c0-2.2 1.8-4 4-4V8zm16 0c-3.9 0-7 3.1-7 7v9h9v-9h-6c0-2.2 1.8-4 4-4V8z" />
              </svg>
              <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
              <div className="pt-1">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400">{school}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Register your school',
      desc: 'Sign up in under 5 minutes. Enter your school name and details — no IT team or server setup required. Your 30-day free trial starts immediately.',
    },
    {
      n: '02',
      title: 'Import students & staff',
      desc: 'Upload your student list via CSV or add learners one by one. Invite teaching and admin staff by email with their assigned roles and permissions.',
    },
    {
      n: '03',
      title: 'Go digital from day one',
      desc: 'Take attendance on any device, record fees as they come in, generate CBC report cards, and let parents access everything through their own portal.',
    },
  ];

  return (
    <section className="bg-slate-50 py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Up and running in one afternoon
          </h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">
            No implementation project. No consultant. No waiting.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.n} className="relative">
              <div className="text-6xl font-black text-slate-100 leading-none mb-4 select-none">{step.n}</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing teaser ─────────────────────────────────────────────────────────────
function PricingTeaser() {
  return (
    <section className="bg-slate-950 py-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/20 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Simple pricing</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              KES 8,500 base +<br className="hidden sm:block" /> KES 40 per student per term
            </h2>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-md">
              Under 1% of what parents pay in school fees — to run your entire school digitally. Billed 3 times a year, when you collect fees.
              Annual billing saves 15%. No hidden costs, ever.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              {['Annual billing: 15% off', 'VAT invoices provided', 'All features included', 'No student limits'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-slate-400">
                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />{t}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-3 w-full sm:w-auto">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-150 active:scale-[0.98] text-sm"
            >
              Calculate my price <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-slate-300 hover:bg-white/8 hover:text-white transition-all text-sm font-medium"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
function FAQSection() {
  return (
    <section className="bg-white py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Common questions</h2>
          <p className="mt-3 text-slate-500">Everything you need to know before signing up.</p>
        </div>
        <LandingFAQ />
      </div>
    </section>
  );
}

// ── Final CTA ──────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-28 px-4 sm:px-6 text-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/15 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-2xl mx-auto">
        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
          Your school deserves<br /> better tools
        </h2>
        <p className="mt-5 text-slate-400 text-lg leading-relaxed">
          Join Kenyan schools already running on DiraSchool. Full CBC compliance, no setup fee, 30 days free.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-2xl shadow-blue-500/30 transition-all duration-150 active:scale-[0.98] text-base"
          >
            Start your free trial <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:contact@diraschool.com"
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            Questions? Email us →
          </a>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-slate-600">
          {['30-day free trial', 'No credit card', 'Full CBC compliance', '50 students included', 'Cancel any time'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-emerald-500" />{t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ──────────────────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <section className="bg-slate-900 py-20 px-4 sm:px-6 border-t border-white/8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">About DiraSchool</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built in Kenya, for Kenyan schools
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-10 text-slate-400 text-sm leading-relaxed">
          <div className="space-y-4">
            <p>
              DiraSchool was built by educators and engineers who saw firsthand how much time Kenyan school
              administrators lose to manual registers, paper fee records, and end-of-term report card marathons.
            </p>
            <p>
              We set out to build the simplest possible tool that handles the full admin loop — attendance,
              fees, CBC report cards, and the parent portal — without requiring expensive hardware, IT staff,
              or a steep learning curve.
            </p>
          </div>
          <div className="space-y-4">
            <p>
              Our pricing is intentionally transparent: a flat base fee plus a small per-student charge, so
              growing schools never face a sudden billing cliff. There are no hidden modules, no annual
              lock-in, and no surprise upgrades.
            </p>
            <p>
              We are a small, focused team headquartered in Nairobi. Every feature request, support email,
              and bug report lands directly with the people who wrote the code.
            </p>
            <p className="text-slate-500 text-xs pt-1">
              Questions?{' '}
              <a href="mailto:contact@diraschool.com" className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">
                contact@diraschool.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/8 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pb-10 border-b border-white/8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm">Diraschool</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-[200px]">
              CBC school management for Kenyan schools.
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">Product</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              {[['Features', '#'], ['Pricing', '/pricing'], ['Start Free Trial', '/register']].map(([label, href]) => (
                <li key={label}><Link href={href} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">Account</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              {[['Sign in', '/login'], ['Register school', '/register'], ['Forgot password', '/forgot-password']].map(([label, href]) => (
                <li key={label}><Link href={href} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">Contact</p>
            <ul className="space-y-2.5 text-xs text-slate-500">
              <li><a href="mailto:contact@diraschool.com" className="hover:text-white transition-colors">contact@diraschool.com</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} DiraSchool. Built in Kenya 🇰🇪</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-slate-950">
        <MarketingNav />
        <Hero />
        <PaperworkSection />
        <Features />
        <Testimonials />
        <HowItWorks />
        <PricingTeaser />
        <FAQSection />
        <AboutSection />
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
