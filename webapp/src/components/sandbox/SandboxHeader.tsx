import { useNavigate } from "react-router-dom"
import { UserMenu } from "../auth/UserMenu"

export function SandboxHeader() {
  const navigate = useNavigate()

  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "var(--sb-bg-primary)",
        borderBottom: "1px solid var(--sb-accent)",
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: 280 }}>
        <i className="ti ti-flask" style={{ fontSize: 24, color: "var(--sb-accent)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--sb-text-primary)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            MediCoord<span style={{ color: "var(--sb-accent)" }}>AI</span>
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.12em",
              background: "var(--sb-accent-dim)",
              color: "var(--sb-accent)",
              padding: "2px 6px",
              borderRadius: 4,
              lineHeight: 1,
              display: "inline-block",
            }}
          >
            SANDBOX ENVIRONMENT
          </span>
        </div>
      </div>

      {/* Session status strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--sb-bg-tertiary)", borderRadius: 16, border: "1px solid var(--sb-border)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sb-teal)", boxShadow: "0 0 6px var(--sb-teal)" }}></span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sb-text-primary)", letterSpacing: "0.04em" }}>SESSION ACTIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--sb-bg-tertiary)", borderRadius: 16, border: "1px solid var(--sb-border)" }}>
          <i className="ti ti-clock" style={{ fontSize: 14, color: "var(--sb-text-muted)" }}></i>
          <span style={{ fontSize: 12, fontFamily: '"Fira Code", "JetBrains Mono", monospace', color: "var(--sb-text-secondary)", fontWeight: 500 }}>00:04:32</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--sb-bg-tertiary)", borderRadius: 16, border: "1px solid var(--sb-border)" }}>
          <i className="ti ti-user" style={{ fontSize: 14, color: "var(--sb-text-muted)" }}></i>
          <span style={{ fontSize: 12, color: "var(--sb-text-secondary)", fontWeight: 500 }}>1 simulated patient</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--sb-bg-tertiary)", borderRadius: 16, border: "1px solid var(--sb-border)" }}>
          <i className="ti ti-bolt" style={{ fontSize: 14, color: "var(--sb-accent)" }}></i>
          <span style={{ fontSize: 12, color: "var(--sb-text-secondary)", fontWeight: 500 }}>55% load</span>
        </div>
      </div>

      {/* Environment switcher + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <select
          defaultValue="sandbox"
          onChange={e => {
            if (e.target.value === "production") navigate("/")
          }}
          style={{
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            color: "var(--sb-accent)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="sandbox">⬤ Sandbox Environment</option>
          <option value="production">◯ Production</option>
        </select>
        <UserMenu />
      </div>
    </header>
  )
}
