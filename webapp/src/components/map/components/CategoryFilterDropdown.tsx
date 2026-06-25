import { useState, useRef, useEffect } from 'react'
import { FILTER_OPTIONS, type CategoryFilter } from '../config/categories'

interface CategoryFilterDropdownProps {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
  counts: Record<CategoryFilter, number>
}

export function CategoryFilterDropdown({ value, onChange, counts }: CategoryFilterDropdownProps) {
  const selected = FILTER_OPTIONS.find(o => o.value === value)!
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative group flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='map-category-filter appearance-none bg-white/80 hover:bg-white/95 backdrop-blur-md border border-gray-200/60 hover:border-gray-300/80 rounded-full py-2.5 pl-10 pr-11 text-xs font-bold text-gray-800 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 flex items-center justify-between min-w-[180px] relative'
      >
        <div
          className="absolute left-4 w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-300 pointer-events-none"
          style={{ backgroundColor: selected.color }}
        />
        <span className="truncate flex-1 text-left">
          {selected.value === "all"
            ? `All types (${counts.all})`
            : `${selected.label} (${counts[selected.value]})`}
        </span>
        <div
          className="absolute right-4 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-transform duration-300"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 min-w-[220px] bg-white/95 backdrop-blur-xl border border-gray-200/80 shadow-xl rounded-2xl overflow-hidden z-50 flex flex-col py-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className="flex items-center gap-3.5 px-5 py-3 hover:bg-gray-100/80 text-left transition-colors w-full"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
                style={{ backgroundColor: opt.color }}
              />
              <span className="text-xs font-bold text-gray-800">
                {opt.value === "all"
                  ? `All types (${counts.all})`
                  : `${opt.label} (${counts[opt.value]})`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
