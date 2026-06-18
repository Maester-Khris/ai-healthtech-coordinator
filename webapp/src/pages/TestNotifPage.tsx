import { useState } from "react"
import { apiFetch } from "../lib/apiClient"
import { useNotificationPermission, PLAYER_ID_KEY_PREFIX } from "../hooks/useNotificationPermission"
import { usePWAInstall, detectPlatform, type Platform } from "../hooks/usePWAInstall"

const PLATFORM_KEY = "medicoord_onesignal_platform"

const KNOWN_PLATFORMS: Array<{ id: Platform; label: string; icon: string }> = [
  { id: "desktop_chrome",  label: "Web (Chrome)",  icon: "ti-brand-chrome" },
  { id: "desktop_other",   label: "Web",            icon: "ti-world" },
  { id: "android_chrome",  label: "Android",        icon: "ti-brand-android" },
  { id: "ios_safari",      label: "iOS Safari",     icon: "ti-brand-apple" },
]

interface SendResult {
  ok: boolean
  notificationId?: string
  error?: string
}

export default function TestNotifPage() {
  const { playerId, requesting, requestPermission, permissionState } = useNotificationPermission()
  const { platform, installState, isPushSupported, installModalDismissed, isStandalone } = usePWAInstall()
  const currentPlatform = detectPlatform()
  const isIosNotStandalone = platform === "ios_safari" && installState !== "standalone"

  // Resolve all registered platforms — current platform uses reactive hook state,
  // others are read from localStorage each render.
  const registeredPlatforms = KNOWN_PLATFORMS.map(p => ({
    ...p,
    playerId: p.id === currentPlatform
      ? playerId
      : localStorage.getItem(PLAYER_ID_KEY_PREFIX + p.id),
    isCurrent: p.id === currentPlatform,
  })).filter(p => p.playerId)

  const [targetPlatformId, setTargetPlatformId] = useState(currentPlatform)

  const targetPlayerId =
    registeredPlatforms.find(p => p.id === targetPlatformId)?.playerId ??
    registeredPlatforms[0]?.playerId ??
    null

  const [title, setTitle]     = useState("MediCoord Test")
  const [body, setBody]       = useState("Push notification pipeline working ✓")
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<SendResult | null>(null)

  const handleSend = async () => {
    if (!targetPlayerId) return
    setSending(true)
    setResult(null)
    try {
      const res = await apiFetch("/notifications/send", {
        method: "POST",
        body: JSON.stringify({ player_id: targetPlayerId, title, body }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult({ ok: true, notificationId: data.notification_id })
      } else {
        const data = await res.json()
        setResult({ ok: false, error: data.detail ?? "Unknown error" })
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      maxWidth: 520,
      margin: "40px auto",
      padding: "0 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
          Push notification test
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
          Test the full notification pipeline
        </p>
      </div>

      {/* Target device selector */}
      <div style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
      }}>
        <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Target device
          </span>
        </div>
        {KNOWN_PLATFORMS.map(p => {
          const pid = p.id === currentPlatform
            ? playerId
            : localStorage.getItem(PLAYER_ID_KEY_PREFIX + p.id)
          const isSelected  = targetPlatformId === p.id
          const isRegistered = !!pid

          return (
            <div
              key={p.id}
              onClick={() => isRegistered && setTargetPlatformId(p.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom: "1px solid var(--color-border)",
                cursor: isRegistered ? "pointer" : "default",
                background: isSelected && isRegistered ? "rgba(24,95,165,0.06)" : "transparent",
                opacity: isRegistered ? 1 : 0.45,
                transition: "background 0.1s",
              }}
            >
              <i className={`ti ${p.icon}`} style={{
                fontSize: 18,
                color: isSelected && isRegistered ? "var(--color-primary)" : "var(--color-text-secondary)",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {p.label}
                  </span>
                  {p.id === currentPlatform && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "1px 5px",
                      background: "var(--color-primary)",
                      color: "#fff",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}>
                      this device
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--color-text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 1,
                }}>
                  {pid ?? "not registered"}
                </div>
              </div>
              {isSelected && isRegistered && (
                <i className="ti ti-check" style={{ fontSize: 16, color: "var(--color-primary)", flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Status row for current device */}
      <div style={{
        background: "var(--color-step-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 16,
      }}>
        <StatusRow label="permission" value={permissionState} ok={permissionState === "granted"} />
        <StatusRow label="platform"   value={localStorage.getItem(PLATFORM_KEY) ?? currentPlatform} ok />
      </div>

      {/* iOS browser — must install as PWA first */}
      {!playerId && permissionState !== "denied" && isIosNotStandalone && (
        <div style={{
          background: "var(--color-warning-bg)",
          border: "1px solid #F5CBA0",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <i className="ti ti-brand-apple" style={{ fontSize: 18, color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#7C4D0F" }}>
                Install the app first
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#7C4D0F", lineHeight: 1.5 }}>
                iOS push requires the app to be installed. In Safari: tap Share → Add to Home Screen → open from home screen, then come back here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enable button — shown when push is supported and permission not yet decided */}
      {!playerId && permissionState !== "denied" && !isIosNotStandalone && isPushSupported && (
        <div style={{
          background: "var(--color-warning-bg)",
          border: "1px solid #F5CBA0",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 14, color: "#7C4D0F", lineHeight: 1.5 }}>
              This device is not registered. Enable push notifications to test.
            </p>
          </div>
          <button
            onClick={requestPermission}
            disabled={requesting}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: requesting ? "var(--color-border)" : "var(--color-primary)",
              color: requesting ? "var(--color-text-secondary)" : "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: requesting ? "not-allowed" : "pointer",
            }}
          >
            {requesting ? "Enabling…" : "Enable notifications"}
          </button>
        </div>
      )}

      {/* Permission blocked — user must reset in browser settings */}
      {!playerId && permissionState === "denied" && (
        <div style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <i className="ti ti-bell-off" style={{ fontSize: 18, color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#B91C1C" }}>
                Notifications blocked
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#7F1D1D", lineHeight: 1.5 }}>
                To re-enable: open Chrome → tap the lock icon in the address bar → Site settings → Notifications → Allow. Then reload this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Send form */}
      {targetPlayerId && (
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "16px",
          marginBottom: 16,
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
              Body
            </label>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                background: "var(--color-background)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: "100%",
              padding: "12px",
              background: sending ? "var(--color-border)" : "var(--color-primary)",
              color: sending ? "var(--color-text-secondary)" : "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send test notification"}
          </button>
        </div>
      )}

      {result && (
        <div style={{
          background: result.ok ? "var(--color-success-bg)" : "#FEF2F2",
          border: `1px solid ${result.ok ? "#A7F3D0" : "#FECACA"}`,
          borderRadius: 12,
          padding: "14px 16px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}>
          <i
            className={result.ok ? "ti ti-circle-check" : "ti ti-circle-x"}
            style={{ fontSize: 18, color: result.ok ? "var(--color-success)" : "#EF4444", flexShrink: 0, marginTop: 2 }}
          />
          <div>
            {result.ok ? (
              <>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#065F46" }}>Sent</p>
                <p style={{ margin: 0, fontSize: 13, color: "#064E3B" }}>
                  notification_id: {result.notificationId} — check your device
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#B91C1C" }}>Failed</p>
                <p style={{ margin: 0, fontSize: 13, color: "#7F1D1D" }}>{result.error}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* PWA debug — shows conditions that control the install modal in App.tsx */}
      <div style={{
        background: "var(--color-step-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginTop: 8,
      }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          PWA state
        </p>
        <StatusRow label="platform"        value={platform}                   ok={platform !== "unsupported"} />
        <StatusRow label="install_state"   value={installState}               ok={installState === "standalone" || installState === "installable"} />
        <StatusRow label="push_supported"  value={String(isPushSupported)}    ok={isPushSupported} />
        <StatusRow label="standalone"      value={String(isStandalone)}       ok={isStandalone} />
        <StatusRow label="modal_dismissed" value={String(installModalDismissed)} ok={!installModalDismissed} />
        {installModalDismissed && (
          <button
            onClick={() => {
              localStorage.removeItem("medicoord_install_modal_dismissed")
              window.location.reload()
            }}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              color: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset install modal
          </button>
        )}
      </div>
    </div>
  )
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "monospace" }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontFamily: "monospace",
        color: ok ? "var(--color-success)" : "var(--color-warning)",
        maxWidth: 260,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  )
}
