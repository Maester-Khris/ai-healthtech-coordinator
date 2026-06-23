import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../auth/useAuth"

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V12h6v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16,17 21,12 16,7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21" y1="12" x2="9" y2="12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const avatarRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const email = user?.email ?? ""
  const initial = email.charAt(0).toUpperCase()
  const displayName = email
    ? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : ""

  // Close on outside click — check both trigger and portal content
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        avatarRef.current && !avatarRef.current.contains(e.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target as Node))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  const handleOpen = () => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(prev => !prev)
  }

  const handleHome = () => {
    setOpen(false)
    navigate("/app")
  }

  const handleProfile = () => {
    setOpen(false)
    navigate("/setup")
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
  }

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        right: dropdownPos.right,
        zIndex: 9999,
        minWidth: 220,
        background: "white",
        border: "0.5px solid rgba(0,0,0,0.10)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
        padding: "4px 0",
        transformOrigin: "top right",
        animation: "userMenuOpen 0.15s ease forwards",
      }}
    >
      {/* User info header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px 8px",
          borderBottom: "0.5px solid #f3f4f6",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "#185FA5",
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email}
          </p>
        </div>
      </div>

      {/* Home */}
      <button
        onClick={handleHome}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          fontSize: 13,
          minHeight: 40,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#1f2937",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}
      >
        <HomeIcon />
        Home
      </button>

      {/* My profile */}
      <button
        onClick={handleProfile}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          fontSize: 13,
          minHeight: 40,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#1f2937",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}
      >
        <ProfileIcon />
        My profile
      </button>

      {/* Divider */}
      <div style={{ height: "0.5px", background: "#f3f4f6", margin: "2px 0" }} />

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          fontSize: 13,
          minHeight: 40,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#dc2626",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}
      >
        <SignOutIcon />
        Sign out
      </button>
    </div>
  )

  return (
    <div ref={avatarRef} className="relative">
      {/* Avatar + chevron trigger */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "#185FA5",
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 500,
          }}
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
          style={{
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && createPortal(dropdown, document.body)}
    </div>
  )
}
