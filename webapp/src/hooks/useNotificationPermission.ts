import { useState, useEffect, useRef } from "react"
import { detectPlatform } from "./usePWAInstall"

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
      login: (externalId: string) => Promise<void>
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

export function useNotificationPermission(
  externalUserId: string | null
): UseNotificationPermissionResult {
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_ID_KEY_PREFIX + detectPlatform())
    if (stored) setPlayerId(stored)

    if (!("Notification" in window)) {
      setPermissionState("unknown")
      return
    }
    const perm = Notification.permission
    setPermissionState(perm === "default" ? "default" : perm as PermissionState)

    // Keep in sync with the OS/browser permission even when it changes in a
    // different hook instance (e.g. granted via the onboarding wizard's own
    // instance) — avoids this instance showing stale pre-grant state.
    let status: PermissionStatus | null = null
    const handleChange = () => {
      if (status) setPermissionState(status.state as PermissionState)
    }
    navigator.permissions?.query({ name: "notifications" as PermissionName }).then(s => {
      status = s
      status.addEventListener("change", handleChange)
    }).catch(() => {})

    return () => status?.removeEventListener("change", handleChange)
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
      const subscriptionId = window.OneSignal.User.PushSubscription.id ?? null

      if (subscriptionId) {
        localStorage.setItem(PLAYER_ID_KEY_PREFIX + detectPlatform(), subscriptionId)
        localStorage.setItem(PLATFORM_KEY, detectPlatform())
        localStorage.setItem(GRANTED_KEY, "true")
        setPlayerId(subscriptionId)
        setPermissionState("granted")
        if (externalUserId) {
          await window.OneSignal.login(externalUserId)
        }
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
    localStorage.removeItem(PLAYER_ID_KEY_PREFIX + detectPlatform())
    localStorage.removeItem(PLATFORM_KEY)
    localStorage.removeItem(GRANTED_KEY)
    setPlayerId(null)
    setPermissionState("default")
    initialized.current = false
  }

  return { permissionState, playerId, requesting, requestPermission, clearToken }
}
