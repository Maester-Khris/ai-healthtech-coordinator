import { useState, useEffect, useRef } from "react"

export type PermissionState = "unknown" | "default" | "granted" | "denied"

export interface UseNotificationPermissionResult {
  permissionState: PermissionState
  playerId: string | null
  requesting: boolean
  requestPermission: () => Promise<void>
  clearToken: () => void
}

const PLAYER_ID_KEY = "medicoord_onesignal_player_id"
const PLATFORM_KEY  = "medicoord_onesignal_platform"
const GRANTED_KEY   = "medicoord_push_granted"

declare global {
  interface Window {
    OneSignal: {
      push: (fn: () => void) => void
      init: (config: {
        appId: string
        notifyButton: { enable: boolean }
        allowLocalhostAsSecureOrigin?: boolean
      }) => void
      getUserId: (callback: (userId: string | null) => void) => void
    }
  }
}

function detectPlatformLabel(): string {
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
    const stored = localStorage.getItem(PLAYER_ID_KEY)
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
    setRequesting(true)
    try {
      await new Promise<void>((resolve) => {
        window.OneSignal.push(() => {
          window.OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true,
          })
          resolve()
        })
      })

      initialized.current = true

      const userId = await new Promise<string | null>((resolve) => {
        window.OneSignal.push(() => {
          window.OneSignal.getUserId((id: string | null) => resolve(id))
        })
      })

      if (userId) {
        localStorage.setItem(PLAYER_ID_KEY, userId)
        localStorage.setItem(PLATFORM_KEY, detectPlatformLabel())
        localStorage.setItem(GRANTED_KEY, "true")
        setPlayerId(userId)
        setPermissionState("granted")
      } else {
        const perm = Notification.permission
        setPermissionState(perm as PermissionState)
      }
    } catch (err) {
      console.error("[OneSignal] init failed:", err)
    } finally {
      setRequesting(false)
    }
  }

  const clearToken = () => {
    localStorage.removeItem(PLAYER_ID_KEY)
    localStorage.removeItem(PLATFORM_KEY)
    localStorage.removeItem(GRANTED_KEY)
    setPlayerId(null)
    setPermissionState("default")
    initialized.current = false
  }

  return { permissionState, playerId, requesting, requestPermission, clearToken }
}
