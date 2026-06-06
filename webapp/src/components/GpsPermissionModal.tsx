interface GpsPermissionModalProps {
  onDismiss: () => void
}

export function GpsPermissionModal({ onDismiss }: GpsPermissionModalProps) {
  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0, 0, 0, 0.55)",
        }}
      />

      <div style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        background: "#ffffff",
        borderRadius: 16,
        padding: "20px 18px 18px",
        width: "calc(100% - 48px)",
        maxWidth: 380,
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.22)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>

        {/* Icon + title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#FEF3E2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <i className="ti ti-map-pin-off" style={{ fontSize: 20, color: "#E8813A" }} />
          </div>
          <h2 style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
            margin: 0,
            lineHeight: 1.3,
          }}>
            Location access is blocked
          </h2>
        </div>

        <p style={{
          fontSize: 13,
          color: "#4B5563",
          lineHeight: 1.5,
          margin: "0 0 12px",
        }}>
          MediCoord needs your location to find nearby healthcare facilities.
          Enable it in your device settings.
        </p>

        {/* Instructions box */}
        <div style={{
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 14,
          fontSize: 12,
          color: "#374151",
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: "#111827" }}>iPhone / Safari:</strong>{" "}
            Settings → Privacy → Location Services → Safari → While Using
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: "#111827" }}>iPhone / Chrome:</strong>{" "}
            Settings → Chrome → Location → Allow
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: "#111827" }}>Android:</strong>{" "}
            Lock icon in address bar → Site settings → Location → Allow
          </div>
          <div>
            <strong style={{ color: "#111827" }}>Desktop:</strong>{" "}
            Location icon in address bar → Allow
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "none",
            background: "#185FA5",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </>
  )
}
