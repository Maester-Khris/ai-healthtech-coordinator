import { LEGEND_ITEMS } from '../config/categories'

export function FacilityLegend({ verticalLegend }: { verticalLegend: boolean }) {
  return (
    <div className="absolute bottom-3 left-3 z-[15] bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-lg px-3 py-2.5 shadow-lg pointer-events-none">
      <p className="text-[10px] font-bold text-gray-800 mb-2 uppercase tracking-wider">Facility Legend</p>
      <div className={verticalLegend ? "flex flex-col gap-1.5" : "flex items-center gap-3"}>
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            {'isPin' in item ? (
              <span
                className="w-2.5 h-2.5 rounded-full inline-block flex-none shadow-sm"
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <span
                className="inline-flex items-center justify-center flex-none rounded shadow-sm"
                style={{
                  width: 18, height: 18,
                  background: item.color,
                  fontSize: 10, fontWeight: 700, color: 'white',
                  borderRadius: 4,
                }}
              >
                {'letter' in item ? item.letter : ''}
              </span>
            )}
            <span className="text-[11px] font-semibold text-gray-600 leading-none">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
