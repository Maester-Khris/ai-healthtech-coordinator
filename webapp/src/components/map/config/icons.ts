import L from 'leaflet'
import cnTowerSvg from '../../../assets/cntower.svg'
import { CATEGORY_STYLES, DEFAULT_STYLE } from './categories'

export const cnTowerIcon = L.divIcon({
  className: '',
  html: `<div style="width:44px;height:44px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
    <img src="${cnTowerSvg}" style="width:100%;height:100%;" />
  </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  tooltipAnchor: [0, -44],
})

export const userIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:24px;height:24px">
    <div class="user-pulse-halo" style="
      position:absolute;inset:-6px;border-radius:50%;
      background:rgba(72,246,193,0.3);
      pointer-events:none;
    "></div>
    <div style="
      position:absolute;inset:0;border-radius:50%;
      background:white;border:3px solid #48F6C1;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      pointer-events:none;
    "></div>
    <div style="
      position:absolute;top:50%;left:50%;width:8px;height:8px;
      border-radius:50%;background:#48F6C1;
      transform:translate(-50%,-50%);
      pointer-events:none;
    "></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
})

export const manualPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <!-- Outer pulsing ring -->
    <circle cx="22" cy="22" r="19" fill="none" stroke="#F97316" stroke-width="1.5" opacity="0.5">
      <animate attributeName="r"       values="19;26"   dur="1.6s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0"   dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <!-- Static mid ring -->
    <circle cx="22" cy="22" r="17" fill="none" stroke="#F97316" stroke-width="1" opacity="0.35"/>
    <!-- Filled centre circle -->
    <circle cx="22" cy="22" r="11" fill="#F97316" filter="drop-shadow(0 2px 6px rgba(249,115,22,0.55))"/>
    <!-- Crosshair lines -->
    <line x1="22" y1="8"  x2="22" y2="15" stroke="white" stroke-width="2"   stroke-linecap="round"/>
    <line x1="22" y1="29" x2="22" y2="36" stroke="white" stroke-width="2"   stroke-linecap="round"/>
    <line x1="8"  y1="22" x2="15" y2="22" stroke="white" stroke-width="2"   stroke-linecap="round"/>
    <line x1="29" y1="22" x2="36" y2="22" stroke="white" stroke-width="2"   stroke-linecap="round"/>
    <!-- Centre dot -->
    <circle cx="22" cy="22" r="3" fill="white"/>
  </svg>`,
  iconSize:    [44, 44],
  iconAnchor:  [22, 22],
  popupAnchor: [0, -26],
})


export function getFacilitySvgInner(category: string, size: number): string {
  if (category === 'hospital') {
    const pad = size * 0.25
    const th = size * 0.2
    const mid = size / 2
    return `<path d="M ${mid - th/2} ${pad} h ${th} v ${mid - th/2 - pad} h ${mid - th/2 - pad} v ${th} h -${mid - th/2 - pad} v ${mid - th/2 - pad} h -${th} v -${mid - th/2 - pad} h -${mid - th/2 - pad} v -${th} h ${mid - th/2 - pad} z" fill="white"/>`
  } else if (category === 'ambulatory') {
    const sw = Math.max(1.8, size * 0.08)
    const points = [
      [size * 0.15, size * 0.5],
      [size * 0.35, size * 0.5],
      [size * 0.43, size * 0.25],
      [size * 0.52, size * 0.75],
      [size * 0.60, size * 0.4],
      [size * 0.68, size * 0.55],
      [size * 0.73, size * 0.5],
      [size * 0.85, size * 0.5]
    ]
    const d = points.reduce((acc, p, i) => i === 0 ? `M ${p[0]} ${p[1]}` : `${acc} L ${p[0]} ${p[1]}`, '')
    return `<path d="${d}" stroke="white" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  } else {
    const w = size * 0.5
    const h = size * 0.5
    const x = (size - w) / 2
    const y = (size - h) / 2 + 1
    return `<path d="M ${x} ${y + h} v -${h*0.5} l ${w*0.5} -${h*0.5} l ${w*0.5} ${h*0.5} v ${h*0.5} z M ${x + w*0.3} ${y + h} v -${h*0.35} h ${w*0.4} v ${h*0.35}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>`
  }
}

export function getFacilityIcon(
  facility: { id?: string; category: string },
  recommendedId: string | null,
  triageActive: boolean,
): L.DivIcon {
  const style = CATEGORY_STYLES[facility.category] ?? DEFAULT_STYLE
  const isRecommended = triageActive && !!facility.id && facility.id === recommendedId
  const isCandidate = triageActive && !isRecommended

  const diameter = isRecommended ? 36 : 22
  const svgSize  = isRecommended ? 64 : 36
  const opacity  = isCandidate ? 0.4 : 1
  const bg       = style.color
  const cx = svgSize / 2
  const cy = svgSize / 2
  const r  = diameter / 2

  // Recommended: mint pulse ring + static mint border
  const rings = isRecommended
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="#48F6C1" stroke-width="1.5" opacity="0.5">
         <animate attributeName="r" values="${r + 6};${r + 18}" dur="1.8s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
       </circle>
       <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#48F6C1" stroke-width="1.5" opacity="0.85"/>`
    : ''

  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="opacity:${opacity}">
      ${rings}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" filter="${isRecommended ? `drop-shadow(0 0 8px ${bg})` : 'none'}"/>
      <g transform="translate(${cx - r}, ${cy - r})">
        ${getFacilitySvgInner(facility.category, diameter)}
      </g>
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -(svgSize / 2 + 4)],
  })
}
