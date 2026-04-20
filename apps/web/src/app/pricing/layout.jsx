export const metadata = {
  title: 'Pricing — DiraSchool CBC School Management System',
  description:
    'Transparent per-term pricing for Kenyan CBC schools. KES 8,500 base fee plus KES 40 per enrolled student per term. No hidden fees, no tier cliffs. 30-day free trial.',
  openGraph: {
    title: 'DiraSchool Pricing — Fair, Transparent & CBC-Aligned',
    description:
      'KES 8,500 base + KES 40 per student per term. Annual billing saves 15%. Calculate your exact price instantly.',
    url: 'https://diraschool.com/pricing',
  },
  alternates: { canonical: 'https://diraschool.com/pricing' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'DiraSchool Pricing',
  url: 'https://diraschool.com/pricing',
  description: 'Pricing plans for DiraSchool CBC school management system for Kenyan schools.',
  mainEntity: {
    '@type': 'SoftwareApplication',
    name: 'DiraSchool',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: 'https://diraschool.com',
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter — 100 to 250 students',
        price: '8500',
        priceCurrency: 'KES',
        description: 'KES 8,500/term base fee + KES 40 per student. Full CBC features for emerging schools.',
      },
      {
        '@type': 'Offer',
        name: 'Growth — 250 to 600 students',
        price: '8500',
        priceCurrency: 'KES',
        description: 'KES 8,500/term base fee + KES 40 per student. Most popular plan for expanding Kenyan schools.',
      },
      {
        '@type': 'Offer',
        name: 'Pro — 600+ students',
        price: '8500',
        priceCurrency: 'KES',
        description: 'KES 8,500/term base fee + KES 40 per student. Priority support and advanced analytics for large schools.',
      },
    ],
  },
};

export default function PricingLayout({ children }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
