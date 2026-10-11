// Original cow mascot illustrations (drawn for this project — not official UC Davis artwork).

export function Cow({ size = 96, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "sleepy" | "wow"; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Cartoon cow mascot">
      {/* horns */}
      <path d="M32 30 Q24 14 36 12 Q38 24 42 30Z" fill="#fff2c4" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" />
      <path d="M88 30 Q96 14 84 12 Q82 24 78 30Z" fill="#fff2c4" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" />
      {/* ears */}
      <ellipse cx="20" cy="44" rx="14" ry="9" transform="rotate(-20 20 44)" fill="#ff8fa3" stroke="#2b2118" strokeWidth="3" />
      <ellipse cx="100" cy="44" rx="14" ry="9" transform="rotate(20 100 44)" fill="#ff8fa3" stroke="#2b2118" strokeWidth="3" />
      {/* head */}
      <rect x="26" y="24" width="68" height="76" rx="32" fill="#ffffff" stroke="#2b2118" strokeWidth="3" />
      {/* spots */}
      <path d="M30 40 Q40 26 56 32 Q52 48 38 50 Q28 50 30 40Z" fill="#2b2118" />
      <circle cx="84" cy="52" r="9" fill="#2b2118" />
      {/* snout */}
      <ellipse cx="60" cy="82" rx="26" ry="17" fill="#ffb3c1" stroke="#2b2118" strokeWidth="3" />
      <ellipse cx="51" cy="82" rx="3.6" ry="5" fill="#2b2118" />
      <ellipse cx="69" cy="82" rx="3.6" ry="5" fill="#2b2118" />
      {/* eyes */}
      {mood === "sleepy" ? (
        <>
          <path d="M42 62 Q48 67 54 62" stroke="#2b2118" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 62 Q72 67 78 62" stroke="#2b2118" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="48" cy="62" r={mood === "wow" ? 7 : 5.5} fill="#2b2118" />
          <circle cx="72" cy="62" r={mood === "wow" ? 7 : 5.5} fill="#2b2118" />
          <circle cx="50" cy="60" r="1.8" fill="#fff" />
          <circle cx="74" cy="60" r="1.8" fill="#fff" />
        </>
      )}
      {/* cheeks */}
      <circle cx="38" cy="74" r="4.5" fill="#ff8fa3" opacity="0.55" />
      <circle cx="82" cy="74" r="4.5" fill="#ff8fa3" opacity="0.55" />
    </svg>
  );
}

// Tiny illustrated students for decoration (original, flat-style).
export function Student({ skin = "#f2b37e", shirt = "#7cc4ff", hair = "#2b2118", size = 56, className = "" }: { skin?: string; shirt?: string; hair?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M12 64 Q12 40 32 40 Q52 40 52 64Z" fill={shirt} stroke="#2b2118" strokeWidth="2.5" />
      <circle cx="32" cy="24" r="14" fill={skin} stroke="#2b2118" strokeWidth="2.5" />
      <path d="M18 22 Q20 8 32 8 Q45 8 46 22 Q38 16 32 18 Q24 16 18 22Z" fill={hair} stroke="#2b2118" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="27" cy="26" r="1.8" fill="#2b2118" />
      <circle cx="37" cy="26" r="1.8" fill="#2b2118" />
      <path d="M28 32 Q32 35 36 32" stroke="#2b2118" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Doodle({ kind, className = "" }: { kind: "star" | "squiggle" | "sun" | "flower"; className?: string }) {
  if (kind === "star")
    return (
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <path d="M20 3 L25 15 L38 16 L28 25 L31 38 L20 31 L9 38 L12 25 L2 16 L15 15Z" fill="#ffd84d" stroke="#2b2118" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "squiggle")
    return (
      <svg viewBox="0 0 80 20" className={className} aria-hidden="true">
        <path d="M2 10 Q12 -2 22 10 T42 10 T62 10 T78 10" stroke="#ff8fa3" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    );
  if (kind === "sun")
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <circle cx="24" cy="24" r="10" fill="#ffd84d" stroke="#2b2118" strokeWidth="2.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="24" y1="4" x2="24" y2="10" stroke="#2b2118" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 24 24)`} />
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="20" cy="9" rx="5.5" ry="8" fill="#b9a4ff" stroke="#2b2118" strokeWidth="2" transform={`rotate(${a} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="5" fill="#ffd84d" stroke="#2b2118" strokeWidth="2" />
    </svg>
  );
}
