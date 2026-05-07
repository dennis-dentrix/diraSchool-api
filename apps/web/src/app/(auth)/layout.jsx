import { Suspense } from 'react';

const BRAND_SVG = (
  <svg viewBox="0 0 64 64" className="w-8 h-8" aria-label="Diraschool">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="#1f5b5e"/>
    <circle cx="32" cy="32" r="18" stroke="#f7f5f0" strokeOpacity="0.18" strokeWidth="1"/>
    <path d="M32 12 L38 32 L32 28 Z" fill="#f7f5f0"/>
    <path d="M32 52 L26 32 L32 36 Z" fill="#f7f5f0" fillOpacity="0.55"/>
    <circle cx="32" cy="32" r="2" fill="#1f5b5e" stroke="#f7f5f0" strokeWidth="1.2"/>
  </svg>
);

const FEATURES = [
  'CBC-aligned assessment & report cards',
  'M-Pesa fee collection & reconciliation',
  'SMS parent notifications',
  'Attendance with geo-fencing',
  'Timetable & lesson plans',
  'Multi-role staff access',
];

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Brand mark — top-left of viewport */}
      <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
        {BRAND_SVG}
        <span className="font-display font-bold text-sm tracking-tight">Diraschool</span>
      </div>

      {/* Form column */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-[360px]">
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </div>
      </div>

      {/* Marketing strip — hidden below md */}
      <aside className="hidden md:flex w-[420px] shrink-0 border-l bg-muted/20 flex-col justify-center px-12 py-16 gap-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            CBC School Management
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight leading-snug">
            Everything your school needs, in one place.
          </h2>
          <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
            Trusted by Kenyan schools to manage fees, academics, staff, and parents — built for the CBC curriculum.
          </p>
        </div>

        <ul className="space-y-2.5">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-ok/15 flex items-center justify-center">
                <span className="block h-1.5 w-1.5 rounded-full bg-ok" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm italic text-muted-foreground leading-relaxed">
            "Diraschool cut our fee collection follow-ups by half and our parents love the SMS receipts."
          </p>
          <p className="text-xs font-medium mt-2">— School Administrator, Nairobi</p>
        </div>
      </aside>
    </div>
  );
}
