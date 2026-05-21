UI polish pass — four improvements to the triage display.
Read AGENTS.md and .claude/CLAUDE.md before touching any file.
Confirm branch is feat/triage-mvp before proceeding.

---

## Change 1 — Facility marker SVG: H badge

Replace the current cross SVG with a rounded-square H badge.
Recommended marker is larger with a pulse ring.
Other candidate markers are smaller and muted.

```typescript
function getFacilityIcon(facilityId: string, recommendedId: string | null) {
  const isRecommended = facilityId === recommendedId
  const size = isRecommended ? 38 : 26
  const bg = isRecommended ? "#E24B4A" : "#f0a0a0"
  const textSize = isRecommended ? 16 : 11

  const pulse = isRecommended
    ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2 + 6}"
         fill="none" stroke="#E24B4A" stroke-width="2" opacity="0.3">
         <animate attributeName="r"
           values="${size/2};${size/2 + 10}" dur="1.5s"
           repeatCount="indefinite"/>
         <animate attributeName="opacity"
           values="0.4;0" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : ""

  const svgSize = isRecommended ? size + 20 : size + 4

  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg"
             width="${svgSize}" height="${svgSize}"
             viewBox="0 0 ${svgSize} ${svgSize}">
      ${pulse}
      <rect x="${isRecommended ? 10 : 2}" y="${isRecommended ? 10 : 2}"
            width="${size}" height="${size}" rx="${size * 0.25}"
            fill="${bg}"/>
      <text x="${svgSize/2}" y="${svgSize/2 + textSize * 0.35}"
            text-anchor="middle"
            font-family="system-ui, sans-serif"
            font-size="${textSize}"
            font-weight="700"
            fill="white">H</text>
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -svgSize / 2],
  })
}
```

---

## Change 2 — Facility hover tooltip: name, type, category

When rendering facility markers, bind a tooltip with facility details.
Use `sticky: true` so it follows the cursor.

If using React-Leaflet:
```tsx
<Marker key={f.id} position={[f.lat, f.lng]} icon={getFacilityIcon(f.id, activeTriage.recommendedFacilityId)}>
  <Tooltip sticky>
    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
      <strong>{f.name}</strong><br/>
      {f.category.charAt(0).toUpperCase() + f.category.slice(1)}<br/>
      <span style={{ color: "#666" }}>{f.source_facility_type}</span>
    </div>
  </Tooltip>
</Marker>
```

If using vanilla Leaflet:
```typescript
marker.bindTooltip(
  `<div style="font-size:12px;line-height:1.6">
    <strong>${f.name}</strong><br/>
    ${f.category} · ${f.source_facility_type}
  </div>`,
  { sticky: true }
)
```

Apply to ALL facility markers — both in triage state and default state
(all 393 facilities should show tooltip on hover in the default view too).

---

## Change 3 — Route display: single line to recommended only

Remove polylines to non-recommended facilities.
Only draw ONE dashed line — from user pin to the recommended facility.
Other candidate markers remain visible on the map but no line is drawn to them.

Their ETAs are displayed in the triage card instead (see Change 4).

```typescript
// Only render the recommended route
const recommendedRoute = activeTriage.routes.find(
  r => r.facilityId === activeTriage.recommendedFacilityId
)
const recommendedFacility = visibleFacilities.find(
  f => f.id === activeTriage.recommendedFacilityId
)

// Single polyline to recommended only
if (recommendedRoute && recommendedFacility && activeTriage.userCoords) {
  // React-Leaflet:
  return (
    <Polyline
      key="recommended-route"
      positions={[
        [activeTriage.userCoords.lat, activeTriage.userCoords.lng],
        [recommendedFacility.lat, recommendedFacility.lng],
      ]}
      pathOptions={{
        color: "#185FA5",
        weight: 3,
        dashArray: "10, 7",
        opacity: 0.85,
      }}
    >
      <Tooltip permanent>
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          {recommendedFacility.name} · {recommendedRoute.etaMinutes} min
        </span>
      </Tooltip>
    </Polyline>
  )
}
```

---

## Change 4 — TriageCard layout and button redesign

### Updated layout
┌─────────────────────────────────────────┐
│ [MODERATE badge]                         │  ← severity top
│                                          │
│ Richview Community Care Services Corp    │  ← facility name bold
│ 1540 Kipling Ave, Toronto ON M9R 4C6    │  ← address
│ 4 min drive · 3.2 km     [Best route]  │  ← ETA + badge
│                                          │
│ Other nearby options:                    │  ← other ETAs
│   • Etobicoke Medical Centre  6 min     │
│   • Centennial Park Place     9 min     │
│                                          │
│ The patient reports nausea...            │  ← reasoning italic
│                                          │
│ [Primary action button — full width]    │
│ [Secondary]      [Secondary]            │

### Updated TriageCard component

```typescript
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
    .filter(x => x.facility)

  const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
    emergent: { bg: "#E24B4A", text: "#fff" },
    urgent:   { bg: "#E8813A", text: "#fff" },
    moderate: { bg: "#D4A017", text: "#fff" },
    routine:  { bg: "#1D9E75", text: "#fff" },
  }
  const sev = SEVERITY_COLORS[triage.severity] ?? { bg: "#888", text: "#fff" }

  return (
    <div style={{
      marginTop: 12,
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12,
      overflow: "hidden",
      background: "var(--color-background-secondary)",
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
            <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2, fontSize: 14 }}>
              {recommended.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
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
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
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
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4, fontWeight: 500 }}>
              OTHER NEARBY OPTIONS
            </div>
            {otherRoutes.map(({ route, facility }) => (
              <div key={route.facilityId} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 12, color: "var(--color-text-secondary)",
                padding: "3px 0",
              }}>
                <span>{facility!.name}</span>
                <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginLeft: 8 }}>
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
            color: "var(--color-text-tertiary)",
            fontStyle: "italic",
            borderTop: "0.5px solid var(--color-border-tertiary)",
            paddingTop: 8,
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {triage.reasoning}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* LEGAL NOTE: All buttons are user-initiated only.
              No action triggers autonomously. Each opens a native OS dialog. */}

          {triage.severity === "emergent" && (
            <>
              <button onClick={call911} style={primaryBtn("#E24B4A")}>
                📞 Call 911
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {emergencyContactPhone && (
                  <button onClick={() => messageEmergencyContact(emergencyContactPhone)}
                          style={secondaryBtn()}>
                    💬 Alert contact
                  </button>
                )}
                {recommended && (
                  <button onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                          style={secondaryBtn()}>
                    🗺 Directions
                  </button>
                )}
              </div>
            </>
          )}

          {triage.severity === "urgent" && (
            <>
              {recommended && (
                <button onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                        style={primaryBtn("#185FA5")}>
                  🗺 Get directions
                </button>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {emergencyContactPhone && (
                  <button onClick={() => messageEmergencyContact(emergencyContactPhone)}
                          style={secondaryBtn()}>
                    💬 Alert contact
                  </button>
                )}
                <button onClick={saveRecommendation} style={secondaryBtn()}>
                  💾 Save
                </button>
              </div>
            </>
          )}

          {(triage.severity === "moderate" || triage.severity === "routine") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {recommended && (
                <button onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                        style={primaryBtn("#185FA5", true)}>
                  🗺 Get directions
                </button>
              )}
              <button onClick={saveRecommendation} style={secondaryBtn()}>
                💾 Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function primaryBtn(color: string, half = false): React.CSSProperties {
  return {
    width: half ? "100%" : "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: color,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  }
}

function secondaryBtn(): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  }
}
```

---

## Commit

```bash
git add webapp/src/<MapPanel file> \
        webapp/src/components/triage/TriageCard.tsx

git commit -m "feat(triage-ui): H badge facility markers with pulse, single recommended route, hover tooltips, improved triage card layout and buttons"
```

Verify:
- [ ] Facility markers show rounded H badge, not cross
- [ ] Recommended marker is larger with animated pulse ring
- [ ] Other markers are smaller and muted
- [ ] Hover on any facility marker shows name, category, type
- [ ] Only ONE route line drawn — to recommended facility
- [ ] Permanent ETA tooltip on route line
- [ ] Other facility ETAs shown in triage card under "Other nearby options"
- [ ] Severity appears as colored header bar at top of card
- [ ] Reasoning shows as italic text above buttons
- [ ] Action buttons use two-column layout for secondary actions
- [ ] npx tsc --noEmit passes

