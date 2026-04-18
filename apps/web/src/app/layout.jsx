import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/providers/providers';
import './globals.css';

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: { default: 'Diraschool', template: '%s | Diraschool' },
  description: 'CBC School Management System for Kenyan schools',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
