interface ToolCallProgressProps {
  stage: "idle" | "typing" | "analyzing" | "locating" | "complete"
}

const STAGE_LABELS: Record<"analyzing" | "locating" | "complete", string> = {
  analyzing: "Analyzing symptoms…",
  locating:  "Locating nearby facilities…",
  complete:  "Route calculated",
}

export function ToolCallProgress({ stage }: ToolCallProgressProps) {
  if (stage === "idle" || stage === "complete") return null

  if (stage === "typing") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px" }}>
        {[0, 160, 320].map(delay => (
          <span
            key={delay}
            className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      fontSize: 12,
      color: "var(--color-text-tertiary, #9ca3af)",
      fontStyle: "italic",
    }}>
      <span style={{
        width: 10, height: 10,
        borderRadius: "50%",
        border: "1.5px solid #185FA5",
        borderTopColor: "transparent",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }} />
      {STAGE_LABELS[stage]}
    </div>
  )
}
