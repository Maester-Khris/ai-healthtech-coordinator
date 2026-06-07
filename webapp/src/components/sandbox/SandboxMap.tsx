import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useState } from "react"
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet"
import type { Facility, FacilityCategory } from "@shared/types"
import { cnTowerPos } from "../map/config/constants"
import { cnTowerIcon } from "../map/config/icons"

interface SandboxMapProps {
  facilities: Facility[]
  facilitiesLoading: boolean
}

const DARK_CATEGORY: Record<string, { color: string; letter: string }> = {
  hospital:    { color: "#E87070", letter: "H" },
  ambulatory:  { color: "#4DBFA0", letter: "A" },
  residential: { color: "#85A865", letter: "R" },
}

function getSandboxFacilityIcon(category: string): L.DivIcon {
  const s = DARK_CATEGORY[category] ?? { color: "#888888", letter: "?" }
  const size = 28, svg = 36, text = 12
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${svg}" height="${svg}" viewBox="0 0 ${svg} ${svg}">
      <rect x="4" y="4" width="${size}" height="${size}" rx="${Math.round(size * 0.22)}"
            fill="${s.color}" />
      <text x="${svg / 2}" y="${svg / 2 + text * 0.38}"
            text-anchor="middle"
            font-family="system-ui,-apple-system,sans-serif"
            font-size="${text}" font-weight="700" fill="white">
        ${s.letter}
      </text>
    </svg>`,
    iconSize:    [svg, svg],
    iconAnchor:  [svg / 2, svg / 2],
    popupAnchor: [0, -(svg / 2 + 4)],
  })
}

type CategoryFilter = "all" | FacilityCategory

const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all",         label: "All types" },
  { value: "hospital",    label: "Hospital" },
  { value: "ambulatory",  label: "Walk-in / Clinic" },
  { value: "residential", label: "Residential Care" },
]

const LEGEND_ITEMS = [
  { color: "#E87070", letter: "H", label: "Hospital" },
  { color: "#4DBFA0", letter: "A", label: "Walk-in / Clinic" },
  { color: "#85A865", letter: "R", label: "Residential Care" },
]

export function SandboxMap({ facilities, facilitiesLoading }: SandboxMapProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all")

  const counts: Record<CategoryFilter, number> = {
    all:         facilities.length,
    hospital:    facilities.filter(f => f.category === "hospital").length,
    ambulatory:  facilities.filter(f => f.category === "ambulatory").length,
    residential: facilities.filter(f => f.category === "residential").length,
  }

  const displayed =
    filter === "all" ? facilities : facilities.filter(f => f.category === filter)

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <MapContainer
        center={cnTowerPos}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          tileSize={512}
          zoomOffset={-1}
          detectRetina={true}
        />
        <Marker position={cnTowerPos} icon={cnTowerIcon}>
          <Tooltip className="text-[13px] font-semibold" direction="top">
            CN Tower Area
          </Tooltip>
        </Marker>
        {displayed.map((facility, i) => (
          <Marker
            key={facility.id ?? `${facility.name}-${i}`}
            position={[facility.lat, facility.lng]}
            icon={getSandboxFacilityIcon(facility.category)}
          />
        ))}
      </MapContainer>

      {/* Loading spinner */}
      {facilitiesLoading && (
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 12,
            zIndex: 15,
            background: "rgba(15,17,23,0.88)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--sb-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid var(--sb-accent)",
              borderTopColor: "transparent",
              display: "inline-block",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Loading facilities…
        </div>
      )}

      {/* Top-right overlay: filter dropdown + active count */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as CategoryFilter)}
          style={{
            background: "rgba(15,17,23,0.88)",
            backdropFilter: "blur(4px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            color: "#e8eaf0",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 14px",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({counts[opt.value]})
            </option>
          ))}
        </select>

        <div
          style={{
            background: "rgba(15,17,23,0.88)",
            backdropFilter: "blur(4px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "#e8eaf0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "var(--sb-accent)",
                opacity: 0.5,
                animation: "sb-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <span
              style={{
                position: "relative",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--sb-accent)",
              }}
            />
          </span>
          {facilitiesLoading ? "—" : displayed.length} FACILITIES ACTIVE
        </div>
      </div>

      {/* Bottom-left legend */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 12,
          zIndex: 20,
          background: "rgba(15,17,23,0.88)",
          backdropFilter: "blur(4px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: item.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {item.letter}
            </div>
            <span style={{ fontSize: 11, color: "#8b91a8" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SANDBOX watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "rgba(239,159,39,0.06)",
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          zIndex: 400,
        }}
      >
        SANDBOX
      </div>
    </div>
  )
}
