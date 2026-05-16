import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width={512}
        height={512}
      >
        <rect x="2" y="2" width="60" height="60" rx="14" fill="#1f5b5e" />
        <circle cx="32" cy="32" r="18" stroke="#f7f5f0" strokeOpacity="0.18" strokeWidth="1" />
        <path d="M32 12 L38 32 L32 28 Z" fill="#f7f5f0" />
        <path d="M32 52 L26 32 L32 36 Z" fill="#f7f5f0" fillOpacity="0.55" />
        <circle cx="32" cy="32" r="2" fill="#1f5b5e" stroke="#f7f5f0" strokeWidth="1.2" />
      </svg>
    </div>,
    size,
  );
}
