import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../auth/AuthContext"

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

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#185FA5", flexShrink: 0 }}
        className="flex items-center justify-center text-white"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>{initial}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3">
            <p className="text-gray-500 truncate" style={{ fontSize: 12 }}>{email}</p>
          </div>
          <div className="h-px bg-gray-200" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ fontSize: 13 }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
