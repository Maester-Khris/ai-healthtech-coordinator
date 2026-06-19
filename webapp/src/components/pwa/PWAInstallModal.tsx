import type React from "react"
import type { Platform, InstallState } from "../../hooks/usePWAInstall"

interface PWAInstallModalProps {
  platform: Platform
  installState: InstallState
  isIosVersionSupported: boolean
  isIosNonSafari: boolean
  onInstalled: () => void
  onDismiss: () => void
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
}

export function PWAInstallModal({
  platform,
  installState,
  isIosVersionSupported,
  isIosNonSafari,
  onInstalled,
  onDismiss,
  promptInstall,
}: PWAInstallModalProps) {
  if (installState === "standalone") return null

  const handleAndroidInstall = async () => {
    const result = await promptInstall()
    if (result === "accepted") onInstalled()
    else onDismiss()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom, 0)",
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 28px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{
          width: 40,
          height: 4,
          background: "var(--color-border)",
          borderRadius: 2,
          margin: "0 auto 20px",
        }} />

        {platform === "ios_safari" && <IOSVariant isIosVersionSupported={isIosVersionSupported} onInstalled={onInstalled} onDismiss={onDismiss} />}
        {platform === "android_chrome" && <AndroidVariant onInstall={handleAndroidInstall} onDismiss={onDismiss} />}
        {(platform === "desktop_chrome" || platform === "desktop_other") && <DesktopVariant onEnable={onInstalled} onDismiss={onDismiss} />}
        {platform === "unsupported" && isIosNonSafari && <WrongBrowserVariant onDismiss={onDismiss} />}
      </div>
    </div>
  )
}

function IOSVariant({ isIosVersionSupported, onInstalled, onDismiss }: {
  isIosVersionSupported: boolean
  onInstalled: () => void
  onDismiss: () => void
}) {
  if (!isIosVersionSupported) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: "var(--color-warning)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Push not supported on this device
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Push notifications require iOS 16.4 or later with Safari. Please update your device to enable health alerts.
        </p>
        <button onClick={onDismiss} style={secondaryButtonStyle}>Close</button>
      </>
    )
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-device-mobile" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Add MediCoord to your home screen
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
        Push notifications require the app to be installed. Follow these steps in Safari:
      </p>

      {[
        { icon: "ti-share", label: "Tap the Share button at the bottom of Safari" },
        { icon: "ti-square-plus", label: 'Tap "Add to Home Screen"' },
        { icon: "ti-circle-check", label: 'Tap "Add" — then open from your home screen' },
      ].map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--color-step-bg)", borderRadius: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-info)" }}>{i + 1}</span>
          </div>
          <i className={`ti ${step.icon}`} style={{ fontSize: 18, color: "var(--color-text-info)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{step.label}</span>
        </div>
      ))}

      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "12px 0 20px" }}>
        Requires iOS 16.4 or later
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onInstalled} style={primaryButtonStyle}>
          <i className="ti ti-home-check" style={{ fontSize: 16, marginRight: 6 }} />
          I've installed it
        </button>
        <button onClick={onDismiss} style={secondaryButtonStyle}>Maybe later</button>
      </div>
    </>
  )
}

function WrongBrowserVariant({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-brand-safari" style={{ fontSize: 22, color: "var(--color-warning)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Open MediCoord in Safari
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
        Push notifications on iOS only work in Safari. Copy this page's link and open it in Safari, then add it to your home screen to enable health alerts.
      </p>
      <button onClick={onDismiss} style={secondaryButtonStyle}>Close</button>
    </>
  )
}

function AndroidVariant({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-bell-ringing" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Install MediCoord for health alerts
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
        Get emergency care recommendations sent directly to your device, even when the browser is closed.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onInstall} style={primaryButtonStyle}>
          <i className="ti ti-download" style={{ fontSize: 16, marginRight: 6 }} />
          Install app
        </button>
        <button onClick={onDismiss} style={secondaryButtonStyle}>Not now</button>
      </div>
    </>
  )
}

function DesktopVariant({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-bell" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Enable health alerts
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
        Get push notifications when you need emergency care near you. Works in your browser — no install required.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onEnable} style={primaryButtonStyle}>
          <i className="ti ti-bell-plus" style={{ fontSize: 16, marginRight: 6 }} />
          Enable notifications
        </button>
        <button onClick={onDismiss} style={secondaryButtonStyle}>Skip</button>
      </div>
    </>
  )
}

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  background: "var(--color-primary)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  background: "transparent",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
}
