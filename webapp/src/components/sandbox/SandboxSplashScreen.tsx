import { useState, useEffect } from "react"

const STEPS = [
  { text: "Initializing MediCoord Sandbox v2.0...",            delay: 0,    duration: 600 },
  { text: "Loading synthetic facility dataset (393 records)...", delay: 700,  duration: 700 },
  { text: "Configuring simulation engine...",                   delay: 1500, duration: 500 },
  { text: "Provisioning isolated session...",                   delay: 2100, duration: 600 },
  { text: "Mounting visualization canvas...",                   delay: 2800, duration: 400 },
  { text: "Ready.",                                             delay: 3300, duration: 300 },
]

export function SandboxSplashScreen({ onComplete }: { onComplete: () => void }) {
  // visibleLines: how many lines have appeared
  const [visibleLines, setVisibleLines] = useState(0)
  // completedLines: how many lines have their checkmark
  const [completedLines, setCompletedLines] = useState(0)
  const [showSkip, setShowSkip] = useState(false)
  const [fading, setFading] = useState(false)

  const progress = (completedLines / STEPS.length) * 100

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((step, i) => {
      // Line appears at step.delay
      timers.push(setTimeout(() => setVisibleLines(i + 1), step.delay))
      // Checkmark appears after cursor blinks for duration
      timers.push(setTimeout(() => setCompletedLines(i + 1), step.delay + step.duration))
    })

    // After last checkmark + 400ms pause: fade out then call onComplete
    const lastComplete = STEPS[STEPS.length - 1].delay + STEPS[STEPS.length - 1].duration
    timers.push(
      setTimeout(() => {
        setFading(true)
        timers.push(setTimeout(onComplete, 400))
      }, lastComplete + 400)
    )

    // Skip link after 1s
    timers.push(setTimeout(() => setShowSkip(true), 1000))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "#0f1117",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      <div style={{ width: 560, maxWidth: "90vw" }}>

        {/* Identity header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 32,
          fontFamily: "monospace",
        }}>
          <i className="ti ti-flask" style={{ fontSize: 18, color: "#EF9F27" }} aria-hidden="true" />
          <span style={{
            fontSize: 14,
            color: "#EF9F27",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}>
            MEDICOORD AI
          </span>
          <span style={{
            fontSize: 11,
            color: "#4a5068",
            fontWeight: 500,
            letterSpacing: "0.12em",
            paddingLeft: 8,
            borderLeft: "1px solid #1e2536",
          }}>
            SANDBOX v2.0
          </span>
        </div>

        {/* Terminal lines */}
        <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.9, color: "#94A3B8" }}>
          {STEPS.slice(0, visibleLines).map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span>
                <span style={{ color: "#EF9F27", marginRight: 10 }}>{">"}</span>
                {step.text}
              </span>
              {i < completedLines ? (
                <span style={{ color: "#EF9F27", fontSize: 14, marginLeft: "auto", paddingLeft: 16 }}>✓</span>
              ) : (
                <span className="sandbox-cursor" style={{ marginLeft: 4 }} />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            height: 2,
            background: "#1e2536",
            borderRadius: 1,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: "#EF9F27",
              borderRadius: 1,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>

      </div>

      {/* Skip link */}
      {showSkip && (
        <button
          onClick={() => { setFading(true); setTimeout(onComplete, 400) }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "none",
            border: "none",
            color: "#4a5068",
            fontSize: 12,
            fontFamily: "monospace",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          skip
          <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
        </button>
      )}
    </div>
  )
}
