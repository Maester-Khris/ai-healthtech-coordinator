import { useState, type CSSProperties } from "react"

const SECTION_LABEL: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--sb-text-secondary)",
  margin: "0 0 12px",
  borderLeft: "2px solid var(--sb-accent)",
  paddingLeft: 8,
}

const DIVIDER: CSSProperties = {
  height: "0.5px",
  background: "var(--sb-border)",
  margin: "24px 0",
}

const STATIC_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  borderRadius: 8,
  fontSize: 14,
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
}

const DARK_SELECT: CSSProperties = {
  width: "100%",
  background: "var(--sb-bg-tertiary) url('data:image/svg+xml;utf8,<svg fill=\"%2364748B\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>') no-repeat right 8px center",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-primary)",
  fontSize: 14,
  padding: "8px 32px 8px 10px",
  cursor: "pointer",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
}

export function SimulationPanel({ defaultSystemCapacity = 72 }: { defaultSystemCapacity?: number } = {}) {
  const [capacity, setCapacity] = useState(defaultSystemCapacity)
  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderRight: "1px solid var(--sb-border)",
        overflowY: "auto",
        padding: "24px 20px 40px",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--sb-text-secondary)", margin: "0 0 16px" }}>
        Simulation Configuration
      </p>

      {/* Section 1 — Scenario Templates */}
      <p style={SECTION_LABEL}>Scenario Templates</p>
      <select style={DARK_SELECT}>
        <option>Routine Saturday afternoon</option>
        <option>Friday night ER surge</option>
        <option>Mass casualty event</option>
        <option>Blizzard conditions</option>
      </select>

      <div style={DIVIDER} />

      {/* Section 2 — System Shock Toggles */}
      <p style={SECTION_LABEL}>System Shock Toggles</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* TODO: wire simulation engine */}
        {[
          { label: "Spawn simulated patient", className: "sandbox-shock-btn-neutral" },
          { label: "Force facility outage", className: "sandbox-shock-btn-warning" },
          { label: "Restore all facilities", className: "sandbox-shock-btn-success" }
        ].map(
          item => (
            <button key={item.label} className={item.className} style={STATIC_BTN}>
              <i className="ti ti-plus" style={{ fontSize: 16, flexShrink: 0 }} />
              {item.label}
            </button>
          ),
        )}
      </div>

      <div style={DIVIDER} />

      {/* Section 3 — Emergency Load */}
      <p style={SECTION_LABEL}>Emergency Load</p>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--sb-text-secondary)" }}>System capacity</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#E87070" }}>{capacity}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "var(--sb-bg-tertiary)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 4,
            background: "linear-gradient(90deg, #1D9E75 0%, #EF9F27 60%, #C0392B 90%)",
            clipPath: `inset(0 ${100 - capacity}% 0 0)`,
            transition: "clip-path 0.1s ease-out",
          }}
        />
      </div>
      <input 
        type="range" 
        min={0} 
        max={100} 
        value={capacity}
        onChange={(e) => setCapacity(Number(e.target.value))}
        style={{ width: "100%", marginTop: 12, cursor: "pointer", accentColor: "var(--sb-accent)" }}
      />

      {/* Section 4 — Simulation Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "32px 0 16px" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--sb-border)" }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--sb-text-muted)", textTransform: "uppercase" }}>
          Simulation Controls
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--sb-border)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {(["player-play", "player-pause", "player-stop"] as const).map(icon => (
          <button
            key={icon}
            className="sandbox-playback-btn"
            style={{
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--sb-bg-tertiary)",
              border: "1px solid var(--sb-border)",
              borderRadius: 8,
              color: "var(--sb-text-secondary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <i className={`ti ti-${icon}`} style={{ fontSize: 20 }} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--sb-text-secondary)", fontWeight: 500 }}>Speed:</span>
          <select
            style={{
              background: "var(--sb-bg-tertiary) url('data:image/svg+xml;utf8,<svg fill=\"%2364748B\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>') no-repeat right 6px center",
              border: "0.5px solid var(--sb-border)",
              borderRadius: 6,
              color: "var(--sb-text-secondary)",
              fontSize: 13,
              padding: "8px 26px 8px 10px",
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
          >
            <option>1×</option>
            <option>2×</option>
            <option>5×</option>
          </select>
        </div>
      </div>
    </div>
  )
}
