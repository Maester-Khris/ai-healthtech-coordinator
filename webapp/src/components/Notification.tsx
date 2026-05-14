import { useEffect } from "react"
import { useAuth } from "../auth/AuthContext"

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Notification() {
  const { notification, clearNotification } = useAuth()

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(clearNotification, 5000)
    return () => clearTimeout(timer)
  }, [notification, clearNotification])

  if (!notification) return null

  const isError = notification.type === "error"

  return (
    <div
      role="alert"
      className={`fixed top-5 right-5 z-[300] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full border ${
        isError
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      <span className="mt-0.5 flex-none">
        {isError ? <ErrorIcon /> : <SuccessIcon />}
      </span>
      <span className="flex-1 text-sm font-medium leading-snug">
        {notification.text}
      </span>
      <button
        onClick={clearNotification}
        className="flex-none text-current opacity-40 hover:opacity-80 transition-opacity text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
