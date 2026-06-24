import { useState, type CSSProperties } from "react"

// Section label: color + tracking, no side-stripe (impeccable ban)
const SECTION_LABEL: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--sb-accent)",
  margin: "0 0 10px",
}

const DIVIDER: CSSProperties = {
  height: "0.5px",
  background: "var(--sb-border)",
  margin: "20px 0",
  opacity: 0.5,
}

const STATIC_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  borderRadius: 6,
  fontSize: 13,
  padding: "9px 12px",
  cursor: "pointer",
  textAlign: "left",
}

const DARK_SELECT: CSSProperties = {
  width: "100%",
  background: "var(--sb-bg-tertiary)",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-primary)",
  fontSize: 13,
  padding: "8px 28px 8px 10px",
  cursor: "pointer",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
}

// Quick-stat tile used in the metric header row
function MetricTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--sb-bg-tertiary)",
        border: "0.5px solid var(--sb-border)",
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? "var(--sb-text-primary)", fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--sb-text-muted)", letterSpacing: "0.06em", marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

export function SimulationPanel({ defaultSystemCapacity = 72 }: { defaultSystemCapacity?: number } = {}) {
  const [capacity, setCapacity] = useState(defaultSystemCapacity)

  const capacityColor = capacity >= 85 ? "var(--sb-red)" : capacity >= 65 ? "var(--sb-accent)" : "var(--sb-teal)"

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderRight: "0.5px solid var(--sb-border)",
        overflowY: "auto",
      }}
    >
      {/* Panel header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "0.5px solid var(--sb-border)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sb-text-muted)", margin: 0 }}>
          Simulation Configuration
        </p>
      </div>

      {/* Metric tiles */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
        <MetricTile label="Capacity" value={`${capacity}%`} accent={capacityColor} />
        <MetricTile label="Patients" value="1" accent="var(--sb-blue)" />
        <MetricTile label="Routes" value="2" />
      </div>

      <div style={{ padding: "0 16px 20px" }}>

        {/* Section 1 — Scenario Templates */}
        <p style={SECTION_LABEL}>Scenario</p>
        <div style={{ position: "relative" }}>
          <select style={DARK_SELECT}>
            <option>Routine Saturday afternoon</option>
            <option>Friday night ER surge</option>
            <option>Mass casualty event</option>
            <option>Blizzard conditions</option>
          </select>
          <svg
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
          >
            <path d="M6 9l6 6 6-6" stroke="var(--sb-text-muted)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div style={DIVIDER} />

        {/* Section 2 — System Shock Toggles */}
        <p style={SECTION_LABEL}>System Shocks</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { label: "Spawn simulated patient", className: "sandbox-shock-btn-neutral", icon: "ti-user-plus" },
            { label: "Force facility outage", className: "sandbox-shock-btn-warning", icon: "ti-alert-triangle" },
            { label: "Restore all facilities", className: "sandbox-shock-btn-success", icon: "ti-refresh" }
          ].map(item => (
            <button key={item.label} className={item.className} style={STATIC_BTN}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 14, flexShrink: 0 }} />
              {item.label}
            </button>
          ))}
        </div>

        <div style={DIVIDER} />

        {/* Section 3 — Emergency Load */}
        <p style={SECTION_LABEL}>Emergency Load</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sb-text-secondary)" }}>System capacity</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: capacityColor }}>
            {capacity}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--sb-bg-tertiary)", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 3,
            background: "linear-gradient(90deg, var(--sb-teal) 0%, var(--sb-accent) 60%, var(--sb-red) 90%)",
            clipPath: `inset(0 ${100 - capacity}% 0 0)`,
            transition: "clip-path 0.1s ease-out",
          }} />
        </div>
        <input
          type="range" min={0} max={100} value={capacity}
          onChange={e => setCapacity(Number(e.target.value))}
          style={{ width: "100%", marginTop: 10, cursor: "pointer", accentColor: "var(--sb-accent)" }}
        />

        {/* Section 4 — Simulation Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 14px" }}>
          <div style={{ flex: 1, height: "0.5px", background: "var(--sb-border)", opacity: 0.5 }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--sb-text-muted)", textTransform: "uppercase" }}>
            Playback
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--sb-border)", opacity: 0.5 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["player-play", "player-pause", "player-stop"] as const).map(icon => (
            <button
              key={icon}
              className="sandbox-playback-btn"
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--sb-bg-tertiary)",
                border: "0.5px solid var(--sb-border)",
                borderRadius: 6,
                color: "var(--sb-text-secondary)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <i className={`ti ti-${icon}`} style={{ fontSize: 17 }} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <select style={{ ...DARK_SELECT, width: "auto", padding: "7px 24px 7px 10px", fontSize: 12 }}>
              <option>1×</option>
              <option>2×</option>
              <option>5×</option>
            </select>
            <svg
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="12" height="12" viewBox="0 0 24 24" fill="none"
            >
              <path d="M6 9l6 6 6-6" stroke="var(--sb-text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

      </div>
    </div>
  )
}
