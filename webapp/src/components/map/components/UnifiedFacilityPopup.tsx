import { CATEGORY_STYLES, DEFAULT_STYLE } from '../config/categories'

interface UnifiedFacilityPopupProps {
  name:        string
  category:    string
  address:     string
  distanceKm?: number
}

export function UnifiedFacilityPopup({ name, category, address, distanceKm }: UnifiedFacilityPopupProps) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_STYLE
  return (
    <div style={{ minWidth: 160 }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#111' }}>
        {name}
      </p>
      <span style={{
        display: 'inline-block',
        background: style.color,
        color: 'white',
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 4,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {style.label}
      </span>
      <p style={{ fontSize: 11, color: '#666', marginBottom: distanceKm != null ? 2 : 0 }}>
        {address}
      </p>
      {distanceKm != null && (
        <p style={{ fontSize: 11, color: '#666' }}>~{distanceKm} km away</p>
      )}
    </div>
  )
}
