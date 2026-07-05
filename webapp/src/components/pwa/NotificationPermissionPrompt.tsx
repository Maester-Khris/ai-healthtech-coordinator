
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
    <div
      className="notif-prompt-enter fixed z-[9000] left-1/2 -translate-x-1/2"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        width: "calc(100% - 32px)",
        maxWidth: 440,
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          borderRadius: "12px",
          background: "rgba(10, 29, 39, 0.95)",
          border: "1px solid rgba(28, 70, 89, 0.4)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Bell icon */}
        <div className="w-10 h-10 rounded-lg bg-[#48F6C1]/10 flex items-center justify-center shrink-0">
          <i className="ti ti-bell text-[#48F6C1] text-xl" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#E2F1F5] leading-tight font-sans">
            Enable health alerts
          </p>
          <p className="text-xs text-[#85A4B1] mt-0.5 leading-snug font-sans">
            Get notified when emergency care recommendations are ready.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#85A4B1",
              border: "1px solid rgba(28, 70, 89, 0.4)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            className="hover:text-[#E2F1F5] hover:border-[#1C4659] transition-all font-sans"
          >
            Not now
          </button>
          <button
            onClick={onEnable}
            disabled={requesting}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#061219",
              background: "#48F6C1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            className="hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed font-sans"
          >
            {requesting ? "…" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function shouldShowPermissionPrompt(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return true
  return Date.now() - new Date(ts).getTime() > SEVEN_DAYS_MS
}
