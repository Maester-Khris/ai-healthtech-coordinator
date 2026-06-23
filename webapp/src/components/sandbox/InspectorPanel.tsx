import { useState } from "react"

// Removing static mock chat array

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
  INFO: "#185FA5",
  ALGO: "#1D9E75",
  OK:   "#1D9E75",
  ERR:  "#C0392B",
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
      
      if (lower.includes("chest") || lower.includes("heart") || lower.includes("pain") || lower.includes("breath")) {
        mockRes = "This sounds like a severe emergency. Activating rapid routing to Toronto General Hospital ER. Please hold while we confirm capacity."
      } else if (lower.includes("bring") || lower.includes("what")) {
        mockRes = "Bring your health card (OHIP), a list of any current medications, and a mask. Walk-in wait time is approximately 25 minutes."
      } else if (lower.includes("fever") || lower.includes("cough")) {
        mockRes = "A fever and cough could indicate a minor infection. Directing you to Etobicoke Walk-in Clinic. Current estimated wait is 15 minutes."
      } else if (!input.trim() || input.length < 10) {
        mockRes = "Could you provide a few more details about how you're feeling?"
      }

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: mockRes
        }
      ])
    }, 600)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Messages or Empty State */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--sb-accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <i className="ti ti-message-circle-2" style={{ fontSize: 28, color: "var(--sb-bg-primary)" }}></i>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--sb-text-primary)" }}>How are you feeling?</span>
            <span style={{ fontSize: 13, color: "var(--sb-text-muted)", marginTop: 6 }}>Describe your simulated patient symptoms</span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 15,
                  lineHeight: 1.5,
                  background:
                    msg.role === "user" ? "var(--sb-accent)" : "var(--sb-bg-tertiary)",
                  border:
                    msg.role === "assistant" ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid transparent",
                  color:
                    msg.role === "user" ? "var(--sb-bg-primary)" : "var(--sb-text-primary)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: msg.role === "assistant" ? 4 : 12,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--sb-bg-tertiary)",
            border: "1px solid var(--sb-border)",
            borderRadius: 8,
            padding: "8px 12px",
            gap: 8,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Type patient symptoms..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--sb-text-primary)",
              fontSize: 14,
            }}
          />
          <button onClick={handleSend} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
            <i className="ti ti-send" style={{ fontSize: 18, color: input.trim() ? "var(--sb-accent)" : "var(--sb-text-muted)", transition: "color 0.2s" }} />
          </button>
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
        padding: "16px 0",
        fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", monospace',
      }}
    >
      {STATIC_LOGS.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "44px 44px 1fr",
            alignItems: "flex-start",
            gap: 8,
            padding: "4px 14px",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: "var(--sb-text-muted)", opacity: 0.85, paddingTop: 2 }}>
            {entry.time}
          </span>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                padding: "2px 5px",
                borderRadius: 3,
                background: (LOG_COLORS[entry.type] ?? "#888") + "22",
                color: LOG_COLORS[entry.type] ?? "#888",
                marginTop: 2,
              }}
            >
              {entry.type}
            </span>
          </div>
          <span 
            title={entry.msg}
            style={{ 
              color: "var(--sb-text-secondary)", 
              paddingTop: 2, 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis" 
            }}
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
    <div
      style={{
        width: 400,
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
          borderBottom: "1px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        {(["chat", "logs"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: 48,
              background: tab === t ? "rgba(255, 255, 255, 0.02)" : "none",
              border: "none",
              borderBottom:
                tab === t ? "2px solid var(--sb-accent)" : "2px solid transparent",
              color:
                tab === t ? "var(--sb-text-primary)" : "var(--sb-text-muted)",
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {t === "chat" ? (
              <>
                AI Preview Assistant
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: "var(--sb-accent-dim)",
                    color: "var(--sb-accent)",
                    padding: "2px 5px",
                    borderRadius: 4,
                    letterSpacing: "0.06em",
                  }}
                >
                  MOCK
                </span>
              </>
            ) : (
              "Live System Logs"
            )}
          </button>
        ))}
      </div>

      {tab === "chat" ? <MockChatTab /> : <LogsTab />}
    </div>
  )
}
