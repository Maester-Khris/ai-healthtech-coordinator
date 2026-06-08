import { useState } from "react"
import "./SandboxPage.css"
import { useFacilities } from "../hooks/useFacilities"
import { SandboxHeader } from "../components/sandbox/SandboxHeader"
import { SimulationPanel } from "../components/sandbox/SimulationPanel"
import { SandboxMap } from "../components/sandbox/SandboxMap"
import { InspectorPanel } from "../components/sandbox/InspectorPanel"
import { SandboxMobileGuard } from "../components/sandbox/SandboxMobileGuard"
import { SandboxSplashScreen } from "../components/sandbox/SandboxSplashScreen"

export default function SandboxPage() {
  const [showSplash, setShowSplash] = useState(true)
  const { facilities, loading: facilitiesLoading } = useFacilities()

  return (
    <div
      className="sandbox-layout"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-primary)",
      }}
    >
      {showSplash ? (
        <SandboxSplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <>
          <SandboxHeader />

          <div className="sandbox-mobile-guard">
            <SandboxMobileGuard />
          </div>

          <div className="sandbox-desktop-layout">
            <SimulationPanel />
            <SandboxMap facilities={facilities} facilitiesLoading={facilitiesLoading} />
            <InspectorPanel />
          </div>
        </>
      )}
    </div>
  )
}
