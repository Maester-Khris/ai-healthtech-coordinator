
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
        className="surface-card flex items-center gap-3 px-4 py-3 border border-stratum-border"
        style={{ borderRadius: "var(--radius-stratum-bezel)" }}
      >
        {/* Bell icon */}
        <div className="w-10 h-10 rounded-stratum-control bg-stratum-accent flex items-center justify-center shrink-0">
          <i className="ti ti-bell text-white text-xl" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-stratum-text leading-tight">
            Enable health alerts
          </p>
          <p className="text-xs text-stratum-text-muted mt-0.5 leading-snug">
            Get notified when emergency care recommendations are ready.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-stratum-text-muted border border-stratum-border rounded-stratum-control hover:text-stratum-text transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            onClick={onEnable}
            disabled={requesting}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stratum-accent rounded-stratum-control hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
