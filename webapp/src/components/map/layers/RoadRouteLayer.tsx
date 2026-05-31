import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { useMapContext } from '../context/MapContext'
import { buildTriageCandidates } from '../config/constants'
import { CATEGORY_STYLES, DEFAULT_STYLE } from '../config/categories'

const STYLE_ID = "road-route-layer-styles"

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement("style")
  el.id = STYLE_ID
  el.textContent = `
    @keyframes routeFlow {
      from { stroke-dashoffset: 0; }
      to   { stroke-dashoffset: -17; }
    }
    @keyframes originHalo {
      0%   { transform: scale(0.5); opacity: 0.55; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .route-flow-line {
      animation: routeFlow 3s linear infinite;
    }
    .origin-pulse-halo {
      animation: originHalo 2s ease-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .route-flow-line    { animation: none; }
      .origin-pulse-halo  { animation: none; opacity: 0.12; }
    }
  `
  document.head.appendChild(el)
}

function buildOriginIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:40px;height:40px">
        <div class="origin-pulse-halo" style="
          position:absolute;inset:0;border-radius:50%;
          background:#1C6FC4;pointer-events:none"></div>
        <div style="
          position:absolute;top:50%;left:50%;width:18px;height:18px;
          border-radius:50%;background:white;
          box-shadow:0 1px 5px rgba(0,0,0,0.22);
          transform:translate(-50%,-50%);pointer-events:none"></div>
        <div style="
          position:absolute;top:50%;left:50%;width:11px;height:11px;
          border-radius:50%;background:#1C6FC4;
          transform:translate(-50%,-50%);pointer-events:none"></div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function buildDestinationIcon(
  letter: string,
  color: string,
  etaLabel: string | null,
): L.DivIcon {
  const chip = etaLabel
    ? `<div style="
        margin-top:4px;white-space:nowrap;background:white;
        border:1.5px solid #dde6f0;border-radius:999px;
        padding:2px 9px;font-size:11px;font-weight:600;color:#1a2b40;
        box-shadow:0 2px 6px rgba(0,0,0,0.13);line-height:1.5;
        font-family:system-ui,-apple-system,sans-serif;
        pointer-events:none">${etaLabel}</div>`
    : ""

  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:inline-flex;flex-direction:column;align-items:center;
        pointer-events:none">
        <div style="
          width:38px;height:38px;border-radius:50%;background:${color};
          border:2.5px solid white;display:flex;align-items:center;
          justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.3);
          font-family:system-ui,-apple-system,sans-serif">
          <span style="color:white;font-weight:700;font-size:14px;line-height:1">
            ${letter}
          </span>
        </div>
        <div style="
          width:0;height:0;border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:9px solid ${color};margin-top:-1px;
          pointer-events:none"></div>
        ${chip}
      </div>`,
    iconSize: etaLabel ? [120, 76] : [44, 48],
    iconAnchor: etaLabel ? [60, 46] : [22, 46],
    popupAnchor: [0, -50],
  })
}

export function RoadRouteLayer() {
  const map = useMap()
  const { activeTriage, recommendedId } = useMapContext()
  const layerRef = useRef<L.LayerGroup | null>(null)

  const triageCandidates    = buildTriageCandidates(activeTriage)
  const recommendedFacility = activeTriage.active
    ? triageCandidates.find(f => f.id === recommendedId)
    : undefined

  const userCoords   = activeTriage.active ? activeTriage.userCoords   : null
  const roadGeometry = activeTriage.active ? activeTriage.roadGeometry : null
  const routes       = activeTriage.active ? activeTriage.routes       : []

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    if (!userCoords || !recommendedFacility) return

    ensureStyles()

    const { lat: userLat, lng: userLng } = userCoords
    const { lat: facilityLat, lng: facilityLng } = recommendedFacility

    const positions: [number, number][] =
      roadGeometry && roadGeometry.length > 1
        ? roadGeometry
        : [[userLat, userLng], [facilityLat, facilityLng]]

    console.log(
      "[MapPanel] polyline mode:",
      roadGeometry ? "road geometry" : "straight line fallback",
      "points:", positions.length
    )

    const ROUND = { lineCap: "round" as const, lineJoin: "round" as const, smoothFactor: 1 }

    const shadow = L.polyline(positions, { ...ROUND, color: "#1C6FC4", weight: 14, opacity: 0.18 })
    const casing = L.polyline(positions, { ...ROUND, color: "#FFFFFF",  weight: 13, opacity: 1 })
    const main   = L.polyline(positions, { ...ROUND, color: "#1C6FC4", weight: 7,  opacity: 1 })
    const flow   = L.polyline(positions, {
      ...ROUND,
      color: "#BBDCF8",
      weight: 2.5,
      opacity: 1,
      dashArray: "1 16",
      className: "route-flow-line",
    })

    const originMarker = L.marker([userLat, userLng], {
      icon: buildOriginIcon(),
      zIndexOffset: 100,
    })

    const route    = routes.find(r => r.facilityId === recommendedFacility.id)
    const etaLabel = route ? `${route.etaMinutes} min · ${route.distanceKm} km` : null
    const catStyle = CATEGORY_STYLES[recommendedFacility.category] ?? DEFAULT_STYLE
    const destMarker = L.marker([facilityLat, facilityLng], {
      icon: buildDestinationIcon(catStyle.letter, catStyle.color, etaLabel),
      zIndexOffset: 200,
    })

    layerRef.current = L.layerGroup([shadow, casing, main, flow, originMarker, destMarker])
    layerRef.current.addTo(map)

    const bounds = main.getBounds().extend([facilityLat, facilityLng])
    map.fitBounds(bounds, {
      paddingTopLeft:     [60, 80],
      paddingBottomRight: [100, 60],
      maxZoom: 14,
    })

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [map, userCoords?.lat, userCoords?.lng, recommendedFacility?.lat, recommendedFacility?.lng, roadGeometry, routes.length])

  return null
}
