export function GiftIllustration({ primary, stage }: { primary: string; stage: number }) {
  const lift = stage >= 3 ? 27 : stage * 3;
  return <span className="gift-fallback-art" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none" style={{height:'90%',width:'auto',color:primary}}>
    <path d="m20 57 41 17 39-17v35L61 109 20 92z" fill="currentColor"/><path d="m61 74 39-17v35l-39 17z" fill="#1e0d2d" opacity=".25"/>
    <path d="m35 63 8 4v35l-8-4zm43 4 8-4v35l-8 4z" fill="#edc58f"/>
    <g transform={`translate(0 ${-lift})`}><path d="m15 51 46-19 43 19-43 19z" fill="currentColor"/><path d="m15 51 46 19 43-19v10L61 81 15 61z" fill="currentColor"/><path d="m15 51 46 19 43-19v10L61 81 15 61z" fill="#1e0d2d" opacity=".15"/>
      <path d="m32 44 8-3 49 19-8 4zM32 59l48-19 9 4-48 19z" fill="#f6d6a4"/><path d="M60 50C25 48 35 20 52 32l9 16c8-35 37-22 21-7-8 6-16 8-22 9Z" stroke="#e9bc7d" strokeWidth="5" strokeLinejoin="round"/></g>
  </svg></span>;
}
