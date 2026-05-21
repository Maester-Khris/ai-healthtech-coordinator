import type { TriageUIState } from "../../../../shared/types"
import { useNextActions } from "../../hooks/useNextActions"

interface TriageCardProps {
  triage: TriageUIState
  emergencyContactPhone: string | null
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  emergent: { bg: "#E24B4A", text: "#fff" },
  urgent:   { bg: "#E8813A", text: "#fff" },
  moderate: { bg: "#D4A017", text: "#fff" },
  routine:  { bg: "#1D9E75", text: "#fff" },
}

export function TriageCard({ triage, emergencyContactPhone }: TriageCardProps) {
  const { call911, messageEmergencyContact, getDirections, saveRecommendation } =
    useNextActions(triage.severity)

  if (!triage.active || !triage.severity) return null

  const allFacilities = triage.recommendedFacility
    ? [triage.recommendedFacility, ...triage.nearbyFacilities]
    : triage.nearbyFacilities

  const recommended = allFacilities.find(
    f => f.id === triage.recommendedFacilityId
  ) ?? triage.recommendedFacility

  const recommendedRoute = triage.routes.find(
    r => r.facilityId === triage.recommendedFacilityId
  )

  const otherRoutes = triage.routes
    .filter(r => r.facilityId !== triage.recommendedFacilityId)
    .map(r => ({
      route: r,
      facility: allFacilities.find(f => f.id === r.facilityId),
    }))
    .filter((x): x is typeof x & { facility: NonNullable<typeof x.facility> } => x.facility !== undefined)

  const sev = SEVERITY_COLORS[triage.severity] ?? { bg: "#888", text: "#fff" }

  return (
    <div style={{
      marginTop: 12,
      border: "0.5px solid var(--color-border-tertiary, #e5e7eb)",
      borderRadius: 12,
      overflow: "hidden",
      background: "var(--color-background-secondary, #f8fafc)",
      fontSize: 13,
    }}>
      {/* Severity header bar */}
      <div style={{
        background: sev.bg,
        color: sev.text,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {triage.severity}
        </span>
      </div>

      <div style={{ padding: "12px 14px" }}>

        {/* Recommended facility */}
        {recommended && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, color: "var(--color-text-primary, #111827)", marginBottom: 2, fontSize: 14 }}>
              {recommended.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary, #6b7280)", marginBottom: 6 }}>
              {recommended.address}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {recommendedRoute ? (
                <span style={{
                  fontSize: 12, color: "#185FA5", fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  🚗 {recommendedRoute.etaMinutes} min · {recommendedRoute.distanceKm} km
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary, #9ca3af)" }}>
                  ~{recommended.distanceKm} km away
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, color: "#185FA5",
                background: "#E6F1FB", padding: "2px 7px",
                borderRadius: 10, letterSpacing: "0.04em",
              }}>
                BEST ROUTE
              </span>
            </div>
          </div>
        )}

        {/* Other nearby options with ETAs */}
        {otherRoutes.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 10, color: "var(--color-text-tertiary, #9ca3af)",
              marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              Other nearby options
            </div>
            {otherRoutes.map(({ route, facility }) => (
              <div key={route.facilityId} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 12, color: "var(--color-text-secondary, #6b7280)",
                padding: "3px 0",
              }}>
                <span>{facility.name}</span>
                <span style={{ color: "var(--color-text-tertiary, #9ca3af)", flexShrink: 0, marginLeft: 8 }}>
                  {route.etaMinutes} min
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reasoning */}
        {triage.reasoning && (
          <div style={{
            fontSize: 11,
            color: "var(--color-text-tertiary, #9ca3af)",
            fontStyle: "italic",
            borderTop: "0.5px solid var(--color-border-tertiary, #e5e7eb)",
            paddingTop: 8,
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {triage.reasoning}
          </div>
        )}

        {/* Action buttons */}
        {/* LEGAL NOTE: All buttons are user-initiated only.
            No action triggers autonomously. Each opens a native OS dialog. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {triage.severity === "emergent" && (
            <>
              <PrimaryButton
                onClick={call911}
                icon="ti-phone-call"
                label="Call 911 immediately"
                color="#C0392B"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {emergencyContactPhone && (
                  <SecondaryButton
                    onClick={() => messageEmergencyContact(emergencyContactPhone)}
                    icon="ti-message-2"
                    label="Alert contact"
                  />
                )}
                {recommended && (
                  <SecondaryButton
                    onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                    icon="ti-navigation"
                    label="Directions"
                  />
                )}
              </div>
            </>
          )}

          {triage.severity === "urgent" && (
            <>
              {recommended && (
                <PrimaryButton
                  onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                  icon="ti-navigation"
                  label="Get directions now"
                  color="#185FA5"
                />
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {emergencyContactPhone && (
                  <SecondaryButton
                    onClick={() => messageEmergencyContact(emergencyContactPhone)}
                    icon="ti-message-2"
                    label="Alert contact"
                  />
                )}
                <SecondaryButton
                  onClick={saveRecommendation}
                  icon="ti-bookmark"
                  label="Save"
                />
              </div>
            </>
          )}

          {(triage.severity === "moderate" || triage.severity === "routine") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {recommended && (
                <PrimaryButton
                  onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                  icon="ti-navigation"
                  label="Directions"
                  color="#185FA5"
                />
              )}
              <SecondaryButton
                onClick={saveRecommendation}
                icon="ti-bookmark"
                label="Save"
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function PrimaryButton({ onClick, icon, label, color }: {
  onClick: () => void
  icon: string
  label: string
  color: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "11px 16px",
        borderRadius: 10,
        border: "none",
        background: color,
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
      {label}
    </button>
  )
}

function SecondaryButton({ onClick, icon, label }: {
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "9px 12px",
        borderRadius: 10,
        border: "1px solid var(--color-border-secondary, #d1d5db)",
        background: "var(--color-background-primary, #fff)",
        color: "var(--color-text-primary, #111827)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16, opacity: 0.7 }} />
      {label}
    </button>
  )
}
