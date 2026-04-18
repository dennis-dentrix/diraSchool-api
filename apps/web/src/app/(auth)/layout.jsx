import { Suspense } from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-64 -right-64 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-64 -left-64 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-sky-500/8 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] pointer-events-none" />

      {/* Content */}
      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-5 shadow-xl shadow-blue-500/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Diraschool</h1>
          <p className="text-slate-400 text-sm mt-2 tracking-wide">CBC School Management System</p>
        </div>

        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}
