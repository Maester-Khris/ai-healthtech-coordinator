import { LEGEND_ITEMS } from '../config/categories'

export function FacilityLegend({ verticalLegend }: { verticalLegend: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 12,
      zIndex: 15,
      background: 'rgba(6, 18, 25, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(28, 70, 89, 0.6)',
      borderRadius: 10,
      padding: '10px 14px',
      pointerEvents: 'none',
    }}>
      <p style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#7AA0B0',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Legend
      </p>
      <div style={verticalLegend
        ? { display: 'flex', flexDirection: 'column', gap: 7 }
        : { display: 'flex', alignItems: 'center', gap: 14 }
      }>
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {'isPin' in item ? (
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: item.color,
                display: 'inline-block',
                flexShrink: 0,
                boxShadow: `0 0 6px ${item.color}66`,
              }} />
            ) : (
              <span style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: item.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
                boxShadow: `0 0 6px ${'color' in item ? item.color : ''}55`,
              }}>
                {'letter' in item ? item.letter : ''}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#A0B8C4', lineHeight: 1 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
