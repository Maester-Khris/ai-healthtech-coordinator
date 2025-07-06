import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateRandomPointsInRadius } from "./utils/generator";
import { MapPanel } from "./subcomponent//MapPanel";
import { SimulationForm } from "./subcomponent/SimulationForm";
import type { Entity, RouteData, SimulationParams } from "./types";
import { torontoHealthProviders } from "./utils/provierdata";

const GEOAPIFY_API_KEY = "38d52e39400d4a988407942232a566a6";
const cnTowerPos: [number, number] = [43.6426, -79.3871];
const torontoCentre: [number, number] = [43.6532, -79.3832];

export default function Home() {

  // [
  //   { name: "Toronto General Hospital (UHN)", position: [43.6575, -79.3875] },
  //   { name: "Mount Sinai Hospital",            position: [43.6573, -79.3888] },
  //   { name: "Hospital for Sick Children",      position: [43.6593, -79.3905] },
  //   { name: "St. Michael's Hospital",          position: [43.6527, -79.3757] },
  //   { name: "Sunnybrook Health Sciences",      position: [43.7128, -79.3762] },
  //   { name: "Women's College Hospital",        position: [43.6608, -79.3888] },
  //   { name: "Princess Margaret Cancer Ctr",    position: [43.6568, -79.3879] },
  //   { name: "CAMH (Queen St)",                 position: [43.6454, -79.4087] },
  //   { name: "Michael Garron Hospital",         position: [43.6934, -79.3082] },
  //   { name: "Humber River Hospital",           position: [43.7196, -79.5229] },
  // ]

  const hospitals = useMemo<Entity[]>(() =>torontoHealthProviders, []);

  const [people, setPeople]       = useState<Entity[]>([]);   // start empty
  const [routes, setRoutes]       = useState<RouteData[]>([]);
  const [peopleCount, setCount] = useState(0);          // NEW
  const [timeLeft, setLeft]     = useState(0);  
  const [loading, setLoading]     = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const simTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cfgRef    = useRef<SimulationParams | null>(null);
  const generated = useRef(0);              // running tally  

  const formatTime = useCallback((s?: number) => {
    if (s == null) return "N/A";
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
  }, []);

  const formatDistance = useCallback((m?: number | null) =>
    m == null ? "N/A" : `${(m / 1000).toFixed(2)} km`, []);

  const fetchRoutesForPeople = useCallback(async (newPeople: Entity[]) => {
    if (!newPeople.length) return;

    setLoading(true);
    try {
      const body = JSON.stringify({
        mode: "drive",
        sources:  newPeople.map(p => ({ location: [p.position[1], p.position[0]] })),
        targets:  hospitals.map(h => ({ location: [h.position[1], h.position[0]] })),
      });
      const res = await fetch(`https://api.geoapify.com/v1/routematrix?apiKey=${GEOAPIFY_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const fresh: RouteData[] = [];

      data.sources_to_targets.forEach((srcRow: any[], srcIdx: number) => {
        let best: RouteData | null = null;
        srcRow.forEach((t: any, tgtIdx: number) => {
          if (t.time == null) return;
          if (!best || t.time < best.travelTime) {
            best = {
              person: newPeople[srcIdx],
              provider: hospitals[tgtIdx],
              travelTime: t.time,
              distance: t.distance,
            };
          }
        });
        best && fresh.push(best);
      });

      setRoutes(prev => [...prev, ...fresh]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [hospitals]);

  // incremental peole loading
  const addRandomPeople = useCallback((qty: number) => {
      if (!qty) return;
      const newcomers = generateRandomPointsInRadius(
        torontoCentre[0],
        torontoCentre[1],
        12,
        qty
      );
      setPeople(prev => [...prev, ...newcomers]);   // triggers re‑render
      setCount(prev => prev + newcomers.length);
      fetchRoutesForPeople(newcomers);       
      generated.current += newcomers.length;       // only new people
    },
    [fetchRoutesForPeople]
  );

  // ─── launch + paced generation loop ─────────────────────────────────────
  const startSimulation = useCallback((cfg: SimulationParams) => {
    if (isRunning) return;          // guard against double‑click
    if (isRunning) return;
    // reset everything
    setPeople([]);
    setRoutes([]);
    generated.current = 0;
    cfgRef.current    = cfg;

    setIsRunning(true);
    console.log("simu started");

    const endAt = Date.now() + cfg.durationMin * 60_000;

    const tick = () => {
      if (!cfgRef.current) return;
      const { totalPeople, maxIntervalSec } = cfgRef.current;

      /* how many may we still add? */
      const left = totalPeople - generated.current;
      if (left <= 0 || Date.now() >= endAt) {
        stopSimulation();          // reached limits
        return;
      }

      /* 1‑3 people but never more than left */
      const qty = Math.min(Math.floor(Math.random() * 3) + 1, left);
      addRandomPeople(qty);

       /* schedule next wave */
      const delay = Math.random() * maxIntervalSec * 1000;
      simTimer.current = setTimeout(tick, delay);

      // if (Date.now() < end) {
      //   simTimer.current = setTimeout(tick, Math.random() * 7000 + 3000); /* schedule next batch in 3‑10 s */
      // } else {
      //   setIsRunning(false);
      // }
    };
    setLeft(cfg.durationMin * 60_000);    
    tick();             
    countdownRef.current = setInterval(() => {
      const remain = endAt - Date.now();
      setLeft(remain > 0 ? remain : 0);         // NEW
      if (remain <= 0) stopSimulation();
    }, 1_000);
  }, [addRandomPeople, isRunning]);

  const stopSimulation = useCallback(() => {
    simTimer.current && clearTimeout(simTimer.current);
    countdownRef.current && clearInterval(countdownRef.current);
    countdownRef.current = null;
    simTimer.current = null;
    cfgRef.current   = null;
    setIsRunning(false);
  }, []);

  /* cleanup when component unmounts */
  useEffect(() => () => stopSimulation(), [stopSimulation]);

  return (
    <section className="w-full grid grid-cols-8 gap-3">
      {/* Map */}
      <div className="col-span-6 p-4 rounded-md bg-gray-100">
        <MapPanel
          cnTowerPos={cnTowerPos}
          zoom={13}
          people={people}
          providers={hospitals}
          routes={routes}
          loadingRoutes={loading}
          formatTime={formatTime}
          formatDistance={formatDistance}
        />
      </div>

      <div className="col-span-2">
        <SimulationForm 
         isRunning={isRunning}
         onLaunch={startSimulation}
         onStop={stopSimulation}
         peopleCount={peopleCount}     /* NEW */
         timeLeftMs={timeLeft}
        />
      </div>
    </section>
  );
}


//=================================================================================================
{/* {peoplesPositions.map((p, index) => (
    <Marker key={index} position={p.position} icon={peopleIcon}>
    </Marker>
))}
{newRoutes.map((route, index) => (
    <Polyline
    key={`route-${index}`}
    positions={[route.person.position, route.provider.position]}
    pathOptions={{ weight: 3, dashArray: "4 8", color: "#0047AB", opacity:0.7 }}
    >
        <Popup>
            <strong>From:</strong> {route.person.name} <br /> 
            <strong>to:</strong> to {route.provider.name} <br /> 
            <strong>Distance:</strong> {(route.distance / 1000).toFixed(2)} km <br />
            <strong>Eta:</strong> {route.travelTime} s
        </Popup>
    </Polyline>
))} */}