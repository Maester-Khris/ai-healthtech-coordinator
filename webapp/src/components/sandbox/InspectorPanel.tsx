import { useState } from "react"

const MOCK_CHAT = [
  {
    role: "user",
    content: "I have a fever of 38.9°C and a sore throat since this morning.",
  },
  {
    role: "assistant",
    content:
      "Based on your symptoms, I'm classifying this as moderate severity. I've located Richview Community Care (4 min away) as the best match for walk-in care.",
  },
  {
    role: "user",
    content: "What should I bring with me?",
  },
  {
    role: "assistant",
    content:
      "Bring your health card (OHIP), a list of any current medications, and a mask. Walk-in wait time is approximately 25 minutes.",
  },
] as const

const STATIC_LOGS = [
  { time: "14:42:01", type: "INFO",      msg: "Sandbox session initialized" },
  { time: "14:42:03", type: "INFO",      msg: "Mock patient generated at [43.6, -79.3]" },
  { time: "14:42:05", type: "ALGORITHM", msg: "Evaluating nearest facilities — severity: urgent" },
  { time: "14:42:06", type: "ALGORITHM", msg: "Candidate: Richview Community Care — ETA 4min" },
  { time: "14:42:07", type: "ALGORITHM", msg: "Candidate: Etobicoke Medical Centre — ETA 6min" },
  { time: "14:42:08", type: "ALGORITHM", msg: "Scoring candidates by ETA + busyness weight" },
  { time: "14:42:09", type: "ALGORITHM", msg: "Richview score: 3.6 | Etobicoke score: 5.2" },
  { time: "14:42:10", type: "SUCCESS",   msg: "Route locked → Richview Community Care" },
  { time: "14:42:11", type: "INFO",      msg: "Redis busyness data age: 4min 32sec" },
  { time: "14:42:12", type: "SUCCESS",   msg: "Patient routed successfully" },
] as const

const LOG_COLORS: Record<string, string> = {
  INFO:      "#185FA5",
  ALGORITHM: "#1D9E75",
  SUCCESS:   "#1D9E75",
  ERROR:     "#C0392B",
}

function MockChatTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Sub-header */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "0.5px solid var(--sb-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--sb-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          AI Preview Assistant
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: "var(--sb-accent-dim)",
            color: "var(--sb-accent)",
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: "0.06em",
          }}
        >
          MOCK
        </span>
      </div>

      {/* Hardcoded messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {MOCK_CHAT.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 12,
                lineHeight: 1.5,
                background:
                  msg.role === "user" ? "var(--sb-accent)" : "var(--sb-bg-tertiary)",
                color:
                  msg.role === "user" ? "#0f1117" : "var(--sb-text-primary)",
                borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                borderBottomLeftRadius: msg.role === "assistant" ? 4 : 12,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Disabled input */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "0.5px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            borderRadius: 8,
            padding: "8px 10px",
            gap: 8,
            opacity: 0.45,
            cursor: "not-allowed",
          }}
        >
          <span style={{ flex: 1, fontSize: 12, color: "var(--sb-text-muted)" }}>
            AI assistant (preview only)
          </span>
          <i className="ti ti-send" style={{ fontSize: 14, color: "var(--sb-text-muted)" }} />
        </div>
      </div>
    </div>
  )
}

function LogsTab() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 0",
        fontFamily: "'Ubuntu Mono', monospace",
      }}
    >
      {STATIC_LOGS.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "4px 14px",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: "var(--sb-text-muted)", flexShrink: 0 }}>
            {entry.time}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 5px",
              borderRadius: 3,
              background: (LOG_COLORS[entry.type] ?? "#888") + "22",
              color: LOG_COLORS[entry.type] ?? "#888",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {entry.type}
          </span>
          <span style={{ color: "var(--sb-text-secondary)" }}>{entry.msg}</span>
        </div>
      ))}
    </div>
  )
}

export function InspectorPanel() {
  const [tab, setTab] = useState<"chat" | "logs">("chat")

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderLeft: "0.5px solid var(--sb-border)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "0.5px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        {(["chat", "logs"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: 40,
              background: "none",
              border: "none",
              borderBottom:
                tab === t ? "2px solid var(--sb-accent)" : "2px solid transparent",
              color:
                tab === t ? "var(--sb-text-primary)" : "var(--sb-text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {t === "chat" ? "AI Preview Assistant" : "Live System Logs"}
          </button>
        ))}
      </div>

      {tab === "chat" ? <MockChatTab /> : <LogsTab />}
    </div>
  )
}
