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
        className="w-full max-w-[480px] px-5 pb-7 pt-6 border-t border-x"
        style={{
          borderRadius: "15px 15px 0 0",
          background: "rgba(10, 29, 39, 0.95)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(28, 70, 89, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-[#1C4659]/50 rounded-full mx-auto mb-5" />

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
          <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
            <i className="ti ti-alert-triangle text-[22px] text-[#F59E0B]" />
          </div>
          <h2 className="text-[17px] font-bold text-[#E2F1F5] font-sans">
            Push not supported on this device
          </h2>
        </div>
        <p className="text-sm text-[#85A4B1] leading-relaxed mb-5 font-sans">
          Push notifications require iOS 16.4 or later with Safari. Please update your device to enable health alerts.
        </p>
        <button onClick={onDismiss} className={secondaryBtn}>Close</button>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-[#132E3C]/40 flex items-center justify-center shrink-0">
          <i className="ti ti-device-mobile text-[22px] text-[#48F6C1]" />
        </div>
        <h2 className="text-[17px] font-bold text-[#E2F1F5] font-sans">
          Add MediCoord to your home screen
        </h2>
      </div>
      <p className="text-sm text-[#85A4B1] leading-relaxed mb-4 font-sans">
        Push notifications require the app to be installed. Follow these steps in Safari:
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {[
          { icon: "ti-share", label: "Tap the Share button at the bottom of Safari" },
          { icon: "ti-square-plus", label: 'Tap "Add to Home Screen"' },
          { icon: "ti-circle-check", label: 'Tap "Add" — then open from your home screen' },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-[#132E3C]/40 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#1C4659]/40 flex items-center justify-center shrink-0">
              <span className="text-[13px] font-bold text-[#48F6C1]">{i + 1}</span>
            </div>
            <i className={`ti ${step.icon} text-[18px] text-[#48F6C1] shrink-0`} />
            <span className="text-[13px] text-[#E2F1F5] leading-snug font-sans">{step.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#85A4B1] my-3 font-sans">Requires iOS 16.4 or later</p>

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
        <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
          <i className="ti ti-brand-safari text-[22px] text-[#F59E0B]" />
        </div>
        <h2 className="text-[17px] font-bold text-[#E2F1F5] font-sans">
          Open MediCoord in Safari
        </h2>
      </div>
      <p className="text-sm text-[#85A4B1] leading-relaxed mb-5 font-sans">
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
        <div className="w-11 h-11 rounded-xl bg-[#132E3C]/40 flex items-center justify-center shrink-0">
          <i className="ti ti-bell-ringing text-[22px] text-[#48F6C1]" />
        </div>
        <h2 className="text-[17px] font-bold text-[#E2F1F5] font-sans">
          Install MediCoord for health alerts
        </h2>
      </div>
      <p className="text-sm text-[#85A4B1] leading-relaxed mb-6 font-sans">
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

const primaryBtn = "w-full py-3.5 px-4 bg-[#48F6C1] text-[#061219] text-[15px] font-bold rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer font-sans"
const secondaryBtn = "w-full py-3.5 px-4 bg-transparent text-[#85A4B1] text-[15px] font-medium border border-[#1C4659]/40 rounded-xl hover:text-[#E2F1F5] hover:border-[#1C4659] transition-all cursor-pointer font-sans"
