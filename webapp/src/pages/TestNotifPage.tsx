import { useState } from "react"
import { apiFetch } from "../lib/apiClient"

const PLAYER_ID_KEY = "medicoord_onesignal_player_id"
const PLATFORM_KEY  = "medicoord_onesignal_platform"

interface SendResult {
  ok: boolean
  notificationId?: string
  error?: string
}

export default function TestNotifPage() {
  const playerId   = localStorage.getItem(PLAYER_ID_KEY) ?? ""
  const platform   = localStorage.getItem(PLATFORM_KEY) ?? "unknown"
  const permission = "Notification" in window ? Notification.permission : "unsupported"

  const [title, setTitle]   = useState("MediCoord Test")
  const [body, setBody]     = useState("Push notification pipeline working ✓")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await apiFetch("/notifications/send", {
        method: "POST",
        body: JSON.stringify({ player_id: playerId, title, body }),
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

      {/* Status card */}
      <div style={{
        background: "var(--color-step-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 20,
      }}>
        <StatusRow label="player_id" value={playerId || "not registered"} ok={!!playerId} />
        <StatusRow label="platform"  value={platform} ok={platform !== "unknown"} />
        <StatusRow label="permission" value={permission} ok={permission === "granted"} />
      </div>

      {!playerId && (
        <div style={{
          background: "var(--color-warning-bg)",
          border: "1px solid #F5CBA0",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 14, color: "#7C4D0F", lineHeight: 1.5 }}>
            No device registered. Go to the app and enable push notifications first, then return here.
          </p>
        </div>
      )}

      {playerId && (
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "16px",
          marginBottom: 20,
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
    </div>
  )
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
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
