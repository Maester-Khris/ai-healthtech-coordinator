import type { CSSProperties } from "react"

const SECTION_LABEL: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--sb-text-muted)",
  margin: "0 0 8px",
}

const DIVIDER: CSSProperties = {
  height: "0.5px",
  background: "var(--sb-border)",
  margin: "16px 0",
}

const STATIC_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  background: "var(--sb-bg-tertiary)",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-secondary)",
  fontSize: 12,
  padding: "8px 10px",
  cursor: "default",
  opacity: 0.6,
  textAlign: "left",
}

const DARK_SELECT: CSSProperties = {
  width: "100%",
  background: "var(--sb-bg-tertiary)",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-primary)",
  fontSize: 12,
  padding: "7px 10px",
  cursor: "default",
  outline: "none",
}

export function SimulationPanel() {
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderRight: "0.5px solid var(--sb-border)",
        overflowY: "auto",
        padding: "16px 14px",
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--sb-text-secondary)", margin: "0 0 16px" }}>
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
        {(["Spawn simulated patient", "Force facility outage", "Restore all facilities"] as const).map(
          label => (
            <button key={label} style={STATIC_BTN}>
              <i className="ti ti-plus" style={{ fontSize: 12, flexShrink: 0 }} />
              {label}
            </button>
          ),
        )}
      </div>

      <div style={DIVIDER} />

      {/* Section 3 — Emergency Load */}
      <p style={SECTION_LABEL}>Emergency Load</p>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--sb-text-secondary)" }}>System capacity</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#E87070" }}>72%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "var(--sb-bg-tertiary)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "72%",
            borderRadius: 4,
            background: "linear-gradient(90deg, #1D9E75 0%, #EF9F27 60%, #C0392B 100%)",
          }}
        />
      </div>

      <div style={DIVIDER} />

      {/* Section 4 — Simulation Controls */}
      <p style={SECTION_LABEL}>Simulation Controls</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {(["player-play", "player-pause", "player-stop"] as const).map(icon => (
          <button
            key={icon}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--sb-bg-tertiary)",
              border: "0.5px solid var(--sb-border)",
              borderRadius: 6,
              color: "var(--sb-text-secondary)",
              cursor: "default",
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            <i className={`ti ti-${icon}`} style={{ fontSize: 14 }} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select
          style={{
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            borderRadius: 6,
            color: "var(--sb-text-secondary)",
            fontSize: 11,
            padding: "5px 8px",
            cursor: "default",
            outline: "none",
          }}
        >
          <option>1×</option>
          <option>2×</option>
          <option>5×</option>
        </select>
      </div>
    </div>
  )
}
