
interface NotificationPermissionPromptProps {
  requesting: boolean
  onEnable: () => void
  onDismiss: () => void
}

const DISMISS_KEY = "medicoord_permission_prompt_dismissed"
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function NotificationPermissionPrompt({
  requesting,
  onEnable,
  onDismiss,
}: NotificationPermissionPromptProps) {
  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    onDismiss()
  }

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: 440,
      zIndex: 9000,
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 16,
      padding: "14px 16px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "var(--color-background-info)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <i className="ti ti-bell" style={{ fontSize: 20, color: "var(--color-text-info)" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
          Enable health alerts
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          Get notified when emergency care recommendations are ready.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: "7px 12px",
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Not now
        </button>
        <button
          onClick={onEnable}
          disabled={requesting}
          style={{
            padding: "7px 14px",
            background: "var(--color-primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: requesting ? "not-allowed" : "pointer",
            opacity: requesting ? 0.7 : 1,
          }}
        >
          {requesting ? "…" : "Enable"}
        </button>
      </div>
    </div>
  )
}

export function shouldShowPermissionPrompt(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return true
  return Date.now() - new Date(ts).getTime() > SEVEN_DAYS_MS
}
