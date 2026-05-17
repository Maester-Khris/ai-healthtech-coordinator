import * as Sentry from "@sentry/react"
import { authService } from "../auth/authService"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await authService.getAccessToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const activeSpan = Sentry.getActiveSpan()
  headers["X-Request-ID"] = activeSpan
    ? Sentry.spanToTraceHeader(activeSpan)
    : crypto.randomUUID()

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    throw new Error("Unauthorized")
  }

  return res
}
