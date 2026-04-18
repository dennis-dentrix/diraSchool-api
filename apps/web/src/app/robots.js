export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/login', '/register'],
        disallow: [
          '/dashboard',
          '/billing',
          '/students',
          '/staff',
          '/classes',
          '/fees',
          '/attendance',
          '/exams',
          '/results',
          '/report-cards',
          '/subjects',
          '/timetable',
          '/library',
          '/transport',
          '/audit-logs',
          '/settings',
          '/portal',
          '/superadmin',
          '/verify-email',
          '/reset-password',
          '/accept-invite',
        ],
      },
    ],
    sitemap: 'https://diraschool.ke/sitemap.xml',
  };
}
