export const metadata = {
  title: 'Pricing',
  description:
    'Transparent per-term pricing for Kenyan CBC schools. KES 7,500 base fee plus KES 40 per enrolled student per term. No hidden fees, no tier cliffs.',
  openGraph: {
    title: 'DiraSchool Pricing — Fair, Transparent & CBC-Aligned',
    description:
      'KES 7,500 base + KES 40 per student per term. Annual billing saves 15%. Calculate your exact price instantly.',
    url: 'https://diraschool.ke/pricing',
  },
  alternates: { canonical: 'https://diraschool.ke/pricing' },
};

export default function PricingLayout({ children }) {
  return children;
}
