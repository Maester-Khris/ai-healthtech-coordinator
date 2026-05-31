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

  // Drive the secondary list from nearbyFacilities (always populated by the backend).
  // Attach route ETA when Geoapify data is available; fall back to straight-line distance.
  const otherFacilities = triage.nearbyFacilities.map(f => ({
    facility: f,
    route: triage.routes.find(r => r.facilityId === f.id),
  }))

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

        {/* Other nearby options */}
        {otherFacilities.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 10, color: "var(--color-text-tertiary, #9ca3af)",
              marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              Other nearby options
            </div>
            {otherFacilities.map(({ facility, route }) => (
              <div key={facility.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 12, color: "var(--color-text-secondary, #6b7280)",
                padding: "4px 0",
                borderTop: "0.5px solid var(--color-border-tertiary, #f3f4f6)",
              }}>
                <span style={{
                  flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {facility.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
                    {route
                      ? `${route.etaMinutes} min · ${route.distanceKm} km`
                      : `~${facility.distanceKm} km`}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: "#6b7280",
                    background: "#f3f4f6", padding: "1px 5px",
                    borderRadius: 8, letterSpacing: "0.04em", textTransform: "uppercase" as const,
                  }}>
                    {facility.category === "hospital" ? "Hospital"
                      : facility.category === "ambulatory" ? "Walk-in"
                      : "Care"}
                  </span>
                </div>
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
      style={{ backgroundColor: color }}
      className="group w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white text-[14px] font-bold tracking-wide shadow-sm hover:shadow hover:-translate-y-[1px] hover:brightness-110 active:scale-[0.98] active:translate-y-0 transition-all duration-200 outline-none focus:ring-4 focus:ring-black/10 cursor-pointer"
    >
      <i className={`ti ${icon} text-[18px] transition-transform group-hover:scale-110`} />
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
      className="group w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-200/80 bg-white text-gray-700 text-[13px] font-bold shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 hover:-translate-y-[1px] hover:shadow transition-all duration-200 outline-none focus:ring-4 focus:ring-gray-100 active:scale-[0.98] active:translate-y-0 cursor-pointer"
    >
      <i className={`ti ${icon} text-[16px] text-gray-400 group-hover:text-gray-600 transition-colors`} />
      {label}
    </button>
  )
}
