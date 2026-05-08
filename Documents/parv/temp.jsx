function TeamBadge({ teamKey, size = 56 }) {
  const t = TEAMS[teamKey];
  const id = `grad-${teamKey}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={t.primary} stopOpacity="0.55" />
        </linearGradient>
        <filter id={`glow-${teamKey}`}>
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M32 4 L56 12 L56 32 C56 46 44 56 32 60 C20 56 8 46 8 32 L8 12 Z"
        fill={`url(#${id})`}
        stroke={t.primary}
        strokeWidth="1.5"
        opacity="0.95"
      />
      <path
        d="M32 4 L56 12 L56 32 C56 46 44 56 32 60 C20 56 8 46 8 32 L8 12 Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.5"
      />
      {teamKey === "GG" && (
        <g filter={`url(#glow-${teamKey})`}>
          <path
            d="M22 26 Q22 18 32 18 Q42 18 42 26 L42 38 Q42 44 32 46 Q22 44 22 38 Z"
            fill="#1a1408"
            stroke="#fff"
            strokeWidth="0.6"
          />
          <rect x="24" y="28" width="16" height="2" fill="#1a1408" />
          <rect x="24" y="32" width="16" height="2" fill="#1a1408" />
          <path
            d="M28 18 Q32 10 36 18"
            fill="#1a1408"
            stroke="#fff"
            strokeWidth="0.6"
          />
          <line
            x1="14"
            y1="32"
            x2="22"
            y2="40"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <line
            x1="50"
            y1="32"
            x2="42"
            y2="40"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      )}
      {teamKey === "MS" && (
        <g filter={`url(#glow-${teamKey})`}>
          <circle
            cx="38"
            cy="24"
            r="6"
            fill="#fff"
            stroke="#0a1a2e"
            strokeWidth="0.6"
          />
          <path
            d="M34 22 Q38 24 42 22"
            fill="none"
            stroke="#0a1a2e"
            strokeWidth="0.5"
          />
          <path
            d="M34 26 Q38 24 42 26"
            fill="none"
            stroke="#0a1a2e"
            strokeWidth="0.5"
          />
          <line
            x1="14"
            y1="20"
            x2="28"
            y2="22"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
          <line
            x1="14"
            y1="26"
            x2="28"
            y2="26"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="14"
            y1="32"
            x2="28"
            y2="30"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
          <rect
            x="28"
            y="36"
            width="4"
            height="14"
            rx="1"
            fill="#fff"
            transform="rotate(-30, 30, 43)"
          />
          <rect
            x="27"
            y="48"
            width="6"
            height="3"
            rx="0.5"
            fill="#fff"
            transform="rotate(-30, 30, 49.5)"
          />
        </g>
      )}
      {teamKey === "MC" && (
        <g filter={`url(#glow-${teamKey})`}>
          <rect x="14" y="36" width="4" height="14" fill="#1a0a2e" />
          <rect x="20" y="30" width="5" height="20" fill="#1a0a2e" />
          <rect x="27" y="22" width="4" height="28" fill="#1a0a2e" />
          <polygon points="29,18 31,22 27,22" fill="#fff" />
          <rect x="33" y="28" width="6" height="22" fill="#1a0a2e" />
          <rect x="41" y="34" width="4" height="16" fill="#1a0a2e" />
          <rect x="47" y="38" width="3" height="12" fill="#1a0a2e" />
          <rect x="22" y="34" width="1" height="1" fill="#fff" />
          <rect x="29" y="28" width="1" height="1" fill="#fff" />
          <rect x="35" y="34" width="1" height="1" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
