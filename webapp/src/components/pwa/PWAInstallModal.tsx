import type { Platform, InstallState } from "../../hooks/usePWAInstall"

interface PWAInstallModalProps {
  platform: Platform
  installState: InstallState
  isIosVersionSupported: boolean
  isIosNonSafari: boolean
  onInstalled: () => void
  onDismiss: () => void
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
}

export function PWAInstallModal({
  platform,
  installState,
  isIosVersionSupported,
  isIosNonSafari,
  onInstalled,
  onDismiss,
  promptInstall,
}: PWAInstallModalProps) {
  if (installState === "standalone") return null

  const handleAndroidInstall = async () => {
    const result = await promptInstall()
    if (result === "accepted") onInstalled()
    else onDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      onClick={onDismiss}
    >
      <div
        className="surface-card w-full max-w-[480px] px-5 pb-7 pt-6 border-t border-x border-stratum-border"
        style={{ borderRadius: "15px 15px 0 0" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-stratum-border rounded-full mx-auto mb-5" />

        {platform === "ios_safari" && (
          <IOSVariant
            isIosVersionSupported={isIosVersionSupported}
            onInstalled={onInstalled}
            onDismiss={onDismiss}
          />
        )}
        {platform === "android_chrome" && (
          <AndroidVariant onInstall={handleAndroidInstall} onDismiss={onDismiss} />
        )}
        {isIosNonSafari && <WrongBrowserVariant onDismiss={onDismiss} />}
      </div>
    </div>
  )
}

function IOSVariant({ isIosVersionSupported, onInstalled, onDismiss }: {
  isIosVersionSupported: boolean
  onInstalled: () => void
  onDismiss: () => void
}) {
  if (!isIosVersionSupported) {
    return (
      <>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-stratum-xl bg-severity-urgent/10 flex items-center justify-center shrink-0">
            <i className="ti ti-alert-triangle text-[22px] text-severity-urgent" />
          </div>
          <h2 className="text-[17px] font-bold text-stratum-text">
            Push not supported on this device
          </h2>
        </div>
        <p className="text-sm text-stratum-text-muted leading-relaxed mb-5">
          Push notifications require iOS 16.4 or later with Safari. Please update your device to enable health alerts.
        </p>
        <button onClick={onDismiss} className={secondaryBtn}>Close</button>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-stratum-xl bg-stratum-bg flex items-center justify-center shrink-0">
          <i className="ti ti-device-mobile text-[22px] text-stratum-accent" />
        </div>
        <h2 className="text-[17px] font-bold text-stratum-text">
          Add MediCoord to your home screen
        </h2>
      </div>
      <p className="text-sm text-stratum-text-muted leading-relaxed mb-4">
        Push notifications require the app to be installed. Follow these steps in Safari:
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {[
          { icon: "ti-share", label: "Tap the Share button at the bottom of Safari" },
          { icon: "ti-square-plus", label: 'Tap "Add to Home Screen"' },
          { icon: "ti-circle-check", label: 'Tap "Add" — then open from your home screen' },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-stratum-bg rounded-stratum-xl">
            <div className="w-8 h-8 rounded-stratum-lg bg-stratum-border/60 flex items-center justify-center shrink-0">
              <span className="text-[13px] font-bold text-stratum-accent">{i + 1}</span>
            </div>
            <i className={`ti ${step.icon} text-[18px] text-stratum-accent shrink-0`} />
            <span className="text-[13px] text-stratum-text leading-snug">{step.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-stratum-text-muted my-3">Requires iOS 16.4 or later</p>

      <div className="flex flex-col gap-2">
        <button onClick={onInstalled} className={primaryBtn}>
          <i className="ti ti-home-check text-base mr-1.5" />
          I've installed it
        </button>
        <button onClick={onDismiss} className={secondaryBtn}>Maybe later</button>
      </div>
    </>
  )
}

function WrongBrowserVariant({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-stratum-xl bg-severity-urgent/10 flex items-center justify-center shrink-0">
          <i className="ti ti-brand-safari text-[22px] text-severity-urgent" />
        </div>
        <h2 className="text-[17px] font-bold text-stratum-text">
          Open MediCoord in Safari
        </h2>
      </div>
      <p className="text-sm text-stratum-text-muted leading-relaxed mb-5">
        Push notifications on iOS only work in Safari. Copy this page's link and open it in Safari, then add it to your home screen to enable health alerts.
      </p>
      <button onClick={onDismiss} className={secondaryBtn}>Close</button>
    </>
  )
}

function AndroidVariant({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-stratum-xl bg-stratum-bg flex items-center justify-center shrink-0">
          <i className="ti ti-bell-ringing text-[22px] text-stratum-accent" />
        </div>
        <h2 className="text-[17px] font-bold text-stratum-text">
          Install MediCoord for health alerts
        </h2>
      </div>
      <p className="text-sm text-stratum-text-muted leading-relaxed mb-6">
        Get emergency care recommendations sent directly to your device, even when the browser is closed.
      </p>
      <div className="flex flex-col gap-2">
        <button onClick={onInstall} className={primaryBtn}>
          <i className="ti ti-download text-base mr-1.5" />
          Install app
        </button>
        <button onClick={onDismiss} className={secondaryBtn}>Not now</button>
      </div>
    </>
  )
}

const primaryBtn = "w-full py-3.5 px-4 bg-stratum-accent text-white text-[15px] font-semibold rounded-stratum-xl flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
const secondaryBtn = "w-full py-3.5 px-4 bg-transparent text-stratum-text-muted text-[15px] font-medium border border-stratum-border rounded-stratum-xl hover:text-stratum-text transition-colors cursor-pointer"
