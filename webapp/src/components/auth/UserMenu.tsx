import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../auth/useAuth"

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const email = user?.email ?? ""
  const initial = email.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex items-center gap-3">
      {/* Avatar + dropdown trigger */}
      <div ref={wrapperRef} className="relative">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1.5"
          aria-label="Account menu"
          aria-expanded={open}
        >
          <span
            style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#185FA5", flexShrink: 0, fontSize: 13, fontWeight: 500 }}
            className="flex items-center justify-center text-white"
          >
            {initial}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M2 4l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
            <div className="px-4 py-3">
              <p className="text-gray-500 truncate" style={{ fontSize: 12 }}>{email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sign out — inline in navbar */}
      <button
        onClick={signOut}
        className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
