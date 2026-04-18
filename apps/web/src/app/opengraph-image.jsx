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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Gradient orb top-right */}
      <div style={{
        position: 'absolute', top: -120, right: -120,
        width: 500, height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
      }} />
      {/* Gradient orb bottom-left */}
      <div style={{
        position: 'absolute', bottom: -80, left: -80,
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
      }} />

      {/* Logo mark */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 48,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
        }}>
          <div style={{
            color: 'white', fontSize: 28, fontWeight: 800, letterSpacing: -1,
          }}>D</div>
        </div>
        <span style={{ color: 'white', fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
          DiraSchool
        </span>
      </div>

      {/* Headline */}
      <div style={{
        fontSize: 64, fontWeight: 800, color: 'white',
        lineHeight: 1.1, letterSpacing: -2,
        maxWidth: 900,
      }}>
        CBC School Management for Kenyan Schools
      </div>

      {/* Subline */}
      <div style={{
        marginTop: 24, fontSize: 28, color: 'rgba(148,163,184,1)',
        fontWeight: 400, maxWidth: 700, lineHeight: 1.4,
      }}>
        Attendance · CBC Report Cards · Fee Management · Parent Portal
      </div>

      {/* Bottom badge */}
      <div style={{
        marginTop: 48,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(59,130,246,0.15)',
        border: '1px solid rgba(59,130,246,0.3)',
        borderRadius: 100, padding: '10px 20px',
      }}>
        <span style={{ color: '#93c5fd', fontSize: 18, fontWeight: 600 }}>
          30-day free trial · No credit card required
        </span>
      </div>
    </div>,
    size,
  );
}
