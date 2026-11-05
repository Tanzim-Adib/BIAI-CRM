import BiaiEmblem from "./BiaiEmblem";

// The small, everyday loading indicator — the logo spinning on its own
// vertical axis. Distinct from CoinLoader, which is the one-time app-open
// intro animation and is left untouched.
export default function SpinnerLogo({ label }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "28px 0",
      }}
    >
      <div style={{ perspective: 400 }}>
        <div className="spinner-logo-rotate">
          <BiaiEmblem size={36} withBackground clipId={`spinner-${Math.random().toString(36).slice(2)}`} />
        </div>
      </div>
      {label && <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{label}</span>}
    </div>
  );
}
