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
  html: `<svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="32" height="32">
    <ellipse cx="12" cy="22" rx="5" ry="2" fill="rgba(0,0,0,0.15)"/>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill="#185FA5"/>
    <circle cx="12" cy="8" r="2.2" fill="white"/>
    <path d="M8.5 14.5c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5"
          fill="white"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

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
  const textSize = isRecommended ? 14 : 10
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
      <text x="${cx}" y="${cy + textSize * 0.38}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="${textSize}" font-weight="700" fill="white">${style.letter}</text>
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -(svgSize / 2 + 4)],
  })
}
