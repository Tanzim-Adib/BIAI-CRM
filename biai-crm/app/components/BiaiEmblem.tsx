const QUADRANTS = [0, 90, 180, 270];

export default function BiaiEmblem({
  size,
  withBackground = false,
  clipId,
}: {
  size: number;
  withBackground?: boolean;
  clipId: string;
}) {
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} style={{ display: "block" }}>
      <defs>
        <clipPath id={clipId}>
          <circle r="100" />
        </clipPath>
      </defs>
      {withBackground && <circle r="100" fill="#fdfaf4" />}
      <g clipPath={`url(#${clipId})`} fill="var(--coin-brand)">
        <g transform="rotate(45)">
          {QUADRANTS.map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <rect x="-110" y="-36" width="127" height="11" />
              <rect x="-110" y="-110" width="63.5" height="66" />
              <rect x="-39.5" y="-110" width="25" height="66" />
              <rect x="-7.5" y="-110" width="25.5" height="66" />
            </g>
          ))}
          <circle r="18" />
        </g>
      </g>
    </svg>
  );
}
