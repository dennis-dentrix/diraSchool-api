import { ImageResponse } from 'next/og';

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
        <svg viewBox="0 0 64 64" width="56" height="56">
          <rect x="2" y="2" width="60" height="60" rx="14" fill="#1f5b5e"/>
          <circle cx="32" cy="32" r="18" stroke="#f7f5f0" strokeOpacity="0.18" strokeWidth="1"/>
          <path d="M32 12 L38 32 L32 28 Z" fill="#f7f5f0"/>
          <path d="M32 52 L26 32 L32 36 Z" fill="#f7f5f0" fillOpacity="0.55"/>
          <circle cx="32" cy="32" r="2" fill="#1f5b5e" stroke="#f7f5f0" strokeWidth="1.2"/>
        </svg>
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
