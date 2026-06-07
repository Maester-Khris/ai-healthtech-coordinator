import { useNavigate } from "react-router-dom"
import { UserMenu } from "../auth/UserMenu"

export function SandboxHeader() {
  const navigate = useNavigate()

  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "var(--sb-bg-primary)",
        borderBottom: "0.5px solid var(--sb-border)",
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ti ti-flask" style={{ fontSize: 20, color: "var(--sb-accent)" }} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--sb-text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          MediCoord
          <span style={{ color: "var(--sb-accent)" }}>AI</span>
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: "var(--sb-accent-dim)",
            color: "var(--sb-accent)",
            padding: "2px 7px",
            borderRadius: 4,
            textTransform: "uppercase" as const,
          }}
        >
          SANDBOX
        </span>
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
