interface ToolCallProgressProps {
  stage: "idle" | "analyzing" | "locating" | "complete"
}

const STAGES = {
  analyzing: "Analyzing symptoms…",
  locating:  "Locating nearby facilities…",
  complete:  "Route calculated",
}

export function ToolCallProgress({ stage }: ToolCallProgressProps) {
  if (stage === "idle" || stage === "complete") return null

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
      {STAGES[stage]}
    </div>
  )
}
