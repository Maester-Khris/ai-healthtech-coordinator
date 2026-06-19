export function SandboxMobileGuard() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--sb-bg-primary)",
        padding: 32,
        textAlign: "center",
      }}
    >
      <i
        className="ti ti-device-desktop-off"
        style={{ fontSize: 48, color: "var(--sb-text-muted)", marginBottom: 24, display: "block" }}
      />
      <h2
        style={{
          color: "var(--sb-text-primary)",
          fontSize: 20,
          fontWeight: 500,
          margin: "0 0 12px",
        }}
      >
        Sandbox requires a larger screen
      </h2>
      <p
        style={{
          color: "var(--sb-text-secondary)",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 320,
          margin: "0 0 28px",
        }}
      >
        The simulation control room is optimized for desktop. Open MediCoord on
        a laptop or desktop to access sandbox.
      </p>
      <a
        href="/"
        style={{
          color: "var(--sb-accent)",
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Return to MediCoord
        <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
      </a>
    </div>
  )
}
