import { useState, useEffect } from "react"

interface ToolCallProgressProps {
  stage: "idle" | "typing" | "analyzing" | "locating" | "complete"
}

const ANALYZE_LINES = [
  "[PARSE] Extracting symptom keywords…",
  "[MATCH] Scoring against ESI severity matrix…",
  "[ROUTE] Acquiring geolocation signal…",
]

const LOCATE_LINES = [
  "[CAPAC] Querying nearby facility capacity…",
  "[DIST]  Computing route distance matrix…",
  "[CALC]  Optimizing multi-modal routes…",
]

export function ToolCallProgress({ stage }: ToolCallProgressProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (stage !== "analyzing" && stage !== "locating") {
      setVisibleCount(0)
      return
    }
    setVisibleCount(1)
    const t1 = setTimeout(() => setVisibleCount(2), 450)
    const t2 = setTimeout(() => setVisibleCount(3), 950)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [stage])

  if (stage === "idle") return null

  if (stage === "typing") {
    return (
      <div className="flex items-center gap-1.5 px-5 py-2.5">
        {[0, 150, 300].map(d => (
          <span
            key={d}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: "#48F6C1", animationDelay: `${d}ms`, opacity: 0.8 }}
          />
        ))}
        <span className="text-mono-meta ml-1.5" style={{ color: "#7AA0B0", fontSize: 11 }}>
          AI is thinking…
        </span>
      </div>
    )
  }

  if (stage === "complete") {
    return (
      <div className="flex items-center gap-2 px-5 py-2">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="#48F6C1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-mono-meta" style={{ color: "#48F6C1", fontSize: 11 }}>Route calculated</span>
      </div>
    )
  }

  const lines = stage === "analyzing" ? ANALYZE_LINES : LOCATE_LINES

  return (
    <div
      className="mx-4 my-1.5 rounded-xl"
      style={{
        background: "rgba(6, 18, 25, 0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(28, 70, 89, 0.55)",
        padding: "10px 14px",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse flex-none"
          style={{ background: "#48F6C1" }}
        />
        <span style={{ color: "#48F6C1", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Agent Processing
        </span>
        <span
          className="animate-spin ml-auto flex-none"
          style={{
            display: "inline-block",
            width: 10, height: 10,
            borderRadius: "50%",
            border: "1.5px solid rgba(72,246,193,0.2)",
            borderTopColor: "#48F6C1",
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        {lines.slice(0, visibleCount).map((line, i) => (
          <span
            key={i}
            className="agent-log-line"
            style={{
              color: i === visibleCount - 1 ? "#48F6C1" : "rgba(72,246,193,0.45)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.02em",
              lineHeight: 1.6,
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}
