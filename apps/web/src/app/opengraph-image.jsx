import { ImageResponse } from 'next/og';
import { BrandLogo } from '@/components/shared/brand-logo';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '72px 80px',
        background: '#f7f5f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Logo mark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
        <BrandLogo width={56} height={56} />
        <span style={{ color: '#0f1410', fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
          Diraschool
        </span>
      </div>

      {/* Headline */}
      <div style={{
        fontSize: 64, fontWeight: 800, color: '#0f1410',
        lineHeight: 1.1, letterSpacing: -2, maxWidth: 900,
      }}>
        CBC School Management for Kenyan Schools
      </div>

      {/* Subline */}
      <div style={{
        marginTop: 24, fontSize: 28, color: '#6b7a70',
        fontWeight: 400, maxWidth: 700, lineHeight: 1.4,
      }}>
        Attendance · CBC Report Cards · Fee Management · Parent Portal
      </div>

      {/* Bottom badge */}
      <div style={{
        marginTop: 48,
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1px solid #d8d3c8',
        borderRadius: 100, padding: '10px 20px',
      }}>
        <span style={{ color: '#1f5b5e', fontSize: 18, fontWeight: 600 }}>
          30-day free trial · No credit card required
        </span>
      </div>
    </div>,
    size,
  );
}
