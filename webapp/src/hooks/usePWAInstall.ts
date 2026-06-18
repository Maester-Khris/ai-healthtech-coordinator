import { useState, useEffect } from "react"

export type Platform =
  | "ios_safari"
  | "android_chrome"
  | "desktop_chrome"
  | "desktop_other"
  | "unsupported"

export type InstallState =
  | "standalone"       // already installed as PWA
  | "installable"      // browser tab, native install prompt available
  | "manual_install"   // browser tab, no prompt (iOS or Firefox)
  | "not_applicable"   // desktop where install is optional

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export interface UsePWAInstallResult {
  platform: Platform
  installState: InstallState
  isStandalone: boolean
  isPushSupported: boolean
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
  installModalDismissed: boolean
  dismissInstallModal: () => void
}

const DISMISS_KEY = "medicoord_install_modal_dismissed"
const INSTALL_MODAL_REARM_MS = 60 * 60 * 1000 // 1 hour

function isInstallModalDismissed(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < INSTALL_MODAL_REARM_MS
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const MSStream = (window as unknown as { MSStream?: unknown }).MSStream
  const isIOS =
    (/iPad|iPhone|iPod/.test(ua) && !MSStream) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
    return isSafari ? "ios_safari" : "unsupported"
  }
  if (/Android/.test(ua)) {
    const isChrome = /Chrome/.test(ua) && !/Chromium/.test(ua)
    return isChrome ? "android_chrome" : "unsupported"
  }
  if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
  return "desktop_other"
}

function detectiOSVersion(): { major: number; minor: number } | null {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  return match
    ? { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) }
    : null
}

export function usePWAInstall(): UsePWAInstallResult {
  const [capturedPrompt, setCapturedPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => isInstallModalDismissed())

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const platform = detectPlatform()
  const iOSVersion = platform === "ios_safari" ? detectiOSVersion() : null

  const isPushSupported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    (platform !== "ios_safari" ||
      (iOSVersion !== null &&
        (iOSVersion.major > 16 || (iOSVersion.major === 16 && iOSVersion.minor >= 4))))

  const installState: InstallState = isStandalone
    ? "standalone"
    : capturedPrompt !== null
      ? "installable"
      : platform === "ios_safari"
        ? "manual_install"
        : "not_applicable"

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setCapturedPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!capturedPrompt) return "unavailable"
    await capturedPrompt.prompt()
    const { outcome } = await capturedPrompt.userChoice
    setCapturedPrompt(null)
    return outcome
  }

  const dismissInstallModal = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setDismissed(true)
  }

  return {
    platform,
    installState,
    isStandalone,
    isPushSupported,
    promptInstall,
    installModalDismissed: dismissed,
    dismissInstallModal,
  }
}
