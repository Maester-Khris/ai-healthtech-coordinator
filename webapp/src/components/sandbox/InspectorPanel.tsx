import { useState } from "react"

const STATIC_LOGS = [
  { time: "42:01", type: "INFO", msg: "Sandbox session initialized" },
  { time: "42:03", type: "INFO", msg: "Mock patient generated at [43.6, -79.3]" },
  { time: "42:05", type: "ALGO", msg: "Evaluating nearest facilities — severity: urgent" },
  { time: "42:06", type: "ALGO", msg: "Candidate: Richview Community Care — ETA 4min" },
  { time: "42:07", type: "ALGO", msg: "Candidate: Etobicoke Medical Centre — ETA 6min" },
  { time: "42:08", type: "ALGO", msg: "Scoring candidates by ETA + busyness weight" },
  { time: "42:09", type: "ALGO", msg: "Richview score: 3.6 | Etobicoke score: 5.2" },
  { time: "42:10", type: "OK",   msg: "Route locked → Richview Community Care" },
  { time: "42:11", type: "INFO", msg: "Redis busyness data age: 4min 32sec" },
  { time: "42:12", type: "OK",   msg: "Patient routed successfully" },
] as const

const LOG_COLORS: Record<string, string> = {
  INFO: "#00D2FF",
  ALGO: "#48F6C1",
  OK:   "#48F6C1",
  ERR:  "#FF7B93",
}

// Compact stats row above tabs
function StatsRow() {
  const stats = [
    { label: "Latency", value: "38ms", ok: true },
    { label: "Events", value: "10", ok: true },
    { label: "Errors", value: "0", ok: true },
    { label: "Uptime", value: "04:32", ok: true },
  ]
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderBottom: "0.5px solid var(--sb-border)",
        flexShrink: 0,
      }}
    >
      {stats.map(s => (
        <div
          key={s.label}
          style={{
            padding: "8px 10px",
            borderRight: "0.5px solid var(--sb-border)",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              color: s.ok ? "var(--sb-accent)" : "var(--sb-red)",
              lineHeight: 1,
            }}
          >
            {s.value}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: "var(--sb-text-muted)", letterSpacing: "0.06em", marginTop: 3, textTransform: "uppercase" }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function MockChatTab() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = { role: "user", content: input }
    setMessages(prev => [...prev, userMsg])
    setInput("")

    setTimeout(() => {
      const lower = input.toLowerCase()
      let mockRes = "Based on your symptoms, I'm classifying this as moderate severity. I've located Richview Community Care (4 min away) as the best match for walk-in care."
      if (lower.includes("chest") || lower.includes("heart") || lower.includes("breath")) {
        mockRes = "This sounds like a severe emergency. Activating rapid routing to Toronto General Hospital ER. Please hold while we confirm capacity."
      } else if (lower.includes("bring") || lower.includes("what")) {
        mockRes = "Bring your health card (OHIP), a list of any current medications, and a mask. Walk-in wait time is approximately 25 minutes."
      } else if (lower.includes("fever") || lower.includes("cough")) {
        mockRes = "A fever and cough could indicate a minor infection. Directing you to Etobicoke Walk-in Clinic. Current estimated wait is 15 minutes."
      } else if (!input.trim() || input.length < 10) {
        mockRes = "Could you provide a few more details about how you're feeling?"
      }
      setMessages(prev => [...prev, { role: "assistant", content: mockRes }])
    }, 600)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
            }}>
              <i className="ti ti-message-circle-2" style={{ fontSize: 22, color: "var(--sb-accent)" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--sb-text-primary)" }}>Simulate a patient</span>
            <span style={{ fontSize: 12, color: "var(--sb-text-muted)", marginTop: 4, textAlign: "center" }}>
              Describe symptoms to test the triage agent
            </span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%",
                borderRadius: 10,
                padding: "9px 13px",
                fontSize: 13,
                lineHeight: 1.5,
                background: msg.role === "user"
                  ? "var(--sb-accent)"
                  : "var(--sb-bg-tertiary)",
                border: msg.role === "assistant"
                  ? "0.5px solid var(--sb-border)"
                  : "0.5px solid transparent",
                color: msg.role === "user" ? "var(--sb-bg-primary)" : "var(--sb-text-primary)",
                borderBottomRightRadius: msg.role === "user" ? 3 : 10,
                borderBottomLeftRadius: msg.role === "assistant" ? 3 : 10,
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--sb-border)", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center",
          background: "var(--sb-bg-tertiary)",
          border: "0.5px solid var(--sb-border)",
          borderRadius: 8,
          padding: "6px 10px",
          gap: 8,
        }}>
          <input
            type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Type patient symptoms…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--sb-text-primary)", fontSize: 13, caretColor: "var(--sb-accent)",
            }}
          />
          <button onClick={handleSend} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
            <i className="ti ti-send" style={{ fontSize: 16, color: input.trim() ? "var(--sb-accent)" : "var(--sb-text-muted)", transition: "color 0.2s" }} />
          </button>
        </div>
      </div>
    </div>
  )
}

function LogsTab() {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 0", fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
      {STATIC_LOGS.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "40px 40px 1fr",
            alignItems: "flex-start",
            gap: 8,
            padding: "3px 14px",
            fontSize: 12,
            lineHeight: 1.7,
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(28,70,89,0.2)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          <span style={{ color: "var(--sb-text-muted)", paddingTop: 1 }}>{entry.time}</span>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 5px",
              borderRadius: 3,
              background: (LOG_COLORS[entry.type] ?? "#888") + "18",
              color: LOG_COLORS[entry.type] ?? "#888",
              marginTop: 2,
              display: "inline-block",
            }}>
              {entry.type}
            </span>
          </div>
          <span
            title={entry.msg}
            style={{ color: "var(--sb-text-secondary)", paddingTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {entry.msg}
          </span>
        </div>
      ))}
    </div>
  )
}

export function InspectorPanel() {
  const [tab, setTab] = useState<"chat" | "logs">("chat")

  return (
    <div style={{
      width: 380,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--sb-bg-secondary)",
      borderLeft: "0.5px solid var(--sb-border)",
    }}>
      {/* Panel label */}
      <div style={{ padding: "10px 14px 0", borderBottom: "0.5px solid var(--sb-border)", flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sb-text-muted)", margin: "0 0 10px" }}>
          Agent Inspector
        </p>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2 }}>
          {(["chat", "logs"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 12px 8px",
                background: "none",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--sb-accent)" : "2px solid transparent",
                color: tab === t ? "var(--sb-text-primary)" : "var(--sb-text-muted)",
                fontSize: 12,
                fontWeight: tab === t ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t === "chat" ? (
                <>
                  AI Preview
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: "var(--sb-accent-dim)",
                    color: "var(--sb-accent)",
                    padding: "1px 5px",
                    borderRadius: 3,
                    letterSpacing: "0.06em",
                  }}>
                    MOCK
                  </span>
                </>
              ) : (
                "System Logs"
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compact stats row */}
      <StatsRow />

      {tab === "chat" ? <MockChatTab /> : <LogsTab />}
    </div>
  )
}
