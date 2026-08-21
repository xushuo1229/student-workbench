/* Soft, rounded "3D-ish" campus mascots — pure SVG, no external assets. */

export function BookStack({ className = '' }) {
  return (
    <svg viewBox="0 0 200 160" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bs1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="bs2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="bs3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#7c3aed" floodOpacity="0.18" />
        </filter>
      </defs>
      <ellipse cx="100" cy="146" rx="78" ry="10" fill="#7c3aed" opacity="0.10" />
      {/* bottom book */}
      <g filter="url(#soft)">
        <rect x="28" y="104" width="144" height="30" rx="12" fill="url(#bs3)" />
        <rect x="28" y="104" width="14" height="30" rx="7" fill="#fff" opacity="0.35" />
      </g>
      {/* middle book */}
      <g filter="url(#soft)">
        <rect x="38" y="74" width="124" height="30" rx="12" fill="url(#bs2)" />
        <rect x="38" y="74" width="14" height="30" rx="7" fill="#fff" opacity="0.35" />
      </g>
      {/* top book */}
      <g filter="url(#soft)">
        <rect x="48" y="46" width="104" height="28" rx="12" fill="url(#bs1)" />
        <rect x="48" y="46" width="13" height="28" rx="6" fill="#fff" opacity="0.4" />
      </g>
      {/* graduation cap */}
      <g filter="url(#soft)">
        <ellipse cx="100" cy="40" rx="34" ry="11" fill="#6d28d9" />
        <path d="M66 40 L100 54 L134 40 L100 26 Z" fill="#7c3aed" />
        <rect x="96" y="52" width="8" height="22" rx="4" fill="#7c3aed" />
        <circle cx="100" cy="78" r="6" fill="#fbbf24" />
      </g>
    </svg>
  )
}

export function SunMascot({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sun" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fbbf24" />
        </radialGradient>
        <filter id="sunsh" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#sunsh)">
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4
          const x1 = 60 + Math.cos(a) * 38
          const y1 = 60 + Math.sin(a) * 38
          const x2 = 60 + Math.cos(a) * 50
          const y2 = 60 + Math.sin(a) * 50
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        })}
        <circle cx="60" cy="60" r="30" fill="url(#sun)" />
      </g>
      <circle cx="51" cy="56" r="3.4" fill="#92400e" />
      <circle cx="69" cy="56" r="3.4" fill="#92400e" />
      <path d="M50 68 Q60 76 70 68" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function PlantPot({ className = '' }) {
  return (
    <svg viewBox="0 0 100 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fda4af" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
        <filter id="psh" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#fb7185" floodOpacity="0.2" />
        </filter>
      </defs>
      <ellipse cx="50" cy="112" rx="34" ry="6" fill="#fb7185" opacity="0.12" />
      <g filter="url(#psh)">
        <path d="M50 60 C30 50 22 28 30 12 C44 22 50 42 50 60 Z" fill="url(#leaf)" />
        <path d="M50 62 C70 52 80 30 72 14 C58 24 50 44 50 62 Z" fill="url(#leaf)" />
        <path d="M50 64 C50 40 50 22 50 8 C56 24 54 46 50 64 Z" fill="#34d399" />
        <path d="M28 64 L72 64 L66 104 L34 104 Z" fill="url(#pot)" />
        <rect x="24" y="56" width="52" height="14" rx="7" fill="#fda4af" />
      </g>
    </svg>
  )
}

export function PencilStar({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a5b4fc" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <filter id="pensh" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#6366f1" floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter="url(#pensh)" transform="rotate(45 60 60)">
        <rect x="52" y="20" width="16" height="70" rx="6" fill="url(#pen)" />
        <rect x="52" y="20" width="6" height="70" rx="3" fill="#fff" opacity="0.35" />
        <path d="M52 90 L60 108 L68 90 Z" fill="#fb923c" />
        <rect x="52" y="14" width="16" height="8" rx="4" fill="#fbbf24" />
      </g>
    </svg>
  )
}
