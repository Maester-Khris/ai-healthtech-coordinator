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
    <div style={{ minWidth: 160, fontFamily: 'var(--font-sans)' }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#3D3A35' }}>
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
      <p style={{ fontSize: 11, color: '#7A756D', marginBottom: distanceKm != null ? 2 : 0 }}>
        {address}
      </p>
      {distanceKm != null && (
        <p style={{ fontSize: 11, color: '#7A756D' }}>~{distanceKm} km away</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, borderTop: '1px solid #DCD6CC', paddingTop: 6 }}>
        <i className="ti ti-clock" style={{ fontSize: 11, color: '#8C8273' }} />
        <span style={{ fontSize: 10, color: '#7A756D', fontWeight: 500 }}>
          Mon - Fri: 9:00 AM - 10:00 PM
        </span>
      </div>
    </div>
  )
}
