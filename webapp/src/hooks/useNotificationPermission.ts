import { useState, useEffect, useRef } from "react"

export type PermissionState = "unknown" | "default" | "granted" | "denied"

export interface UseNotificationPermissionResult {
  permissionState: PermissionState
  playerId: string | null
  requesting: boolean
  requestPermission: () => Promise<void>
  clearToken: () => void
}

export const PLAYER_ID_KEY_PREFIX = "medicoord_onesignal_player_id_"
const PLATFORM_KEY  = "medicoord_onesignal_platform"
const GRANTED_KEY   = "medicoord_push_granted"

declare global {
  interface Window {
    OneSignalDeferred: Array<(oneSignal: Window["OneSignal"]) => Promise<void>>
    OneSignal: {
      init: (config: {
        appId: string
        notifyButton?: { enable: boolean }
        allowLocalhostAsSecureOrigin?: boolean
      }) => Promise<void>
      Notifications: {
        requestPermission: () => Promise<boolean>
      }
      User: {
        PushSubscription: {
          id: string | null | undefined
          optedIn: boolean
        }
      }
    }
  }
}

export function detectPlatformLabel(): string {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return "ios_safari"
  if (/Android/.test(ua)) return "android_chrome"
  if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
  return "desktop_other"
}

export function useNotificationPermission(): UseNotificationPermissionResult {
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel())
    if (stored) setPlayerId(stored)

    if (!("Notification" in window)) {
      setPermissionState("unknown")
      return
    }
    const perm = Notification.permission
    setPermissionState(perm === "default" ? "default" : perm as PermissionState)
  }, [])

  const requestPermission = async () => {
    if (initialized.current) return
    if (!window.OneSignal?.Notifications) {
      console.warn("[OneSignal] SDK not ready")
      return
    }
    if (!("Notification" in window)) {
      return
    }
    if (Notification.permission === "denied") {
      setPermissionState("denied")
      return
    }
    initialized.current = true
    setRequesting(true)
    try {
      await window.OneSignal.Notifications.requestPermission()
      const userId = window.OneSignal.User.PushSubscription.id ?? null

      if (userId) {
        localStorage.setItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel(), userId)
        localStorage.setItem(PLATFORM_KEY, detectPlatformLabel())
        localStorage.setItem(GRANTED_KEY, "true")
        setPlayerId(userId)
        setPermissionState("granted")
      } else {
        setPermissionState(Notification.permission as PermissionState)
      }
    } catch (err) {
      console.error("[OneSignal] init failed:", err)
    } finally {
      setRequesting(false)
    }
  }

  const clearToken = () => {
    localStorage.removeItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel())
    localStorage.removeItem(PLATFORM_KEY)
    localStorage.removeItem(GRANTED_KEY)
    setPlayerId(null)
    setPermissionState("default")
    initialized.current = false
  }

  return { permissionState, playerId, requesting, requestPermission, clearToken }
}
