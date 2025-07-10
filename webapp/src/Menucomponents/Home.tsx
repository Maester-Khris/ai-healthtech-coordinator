import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateRandomPointsInRadius } from "./utils/generator";
import { MapPanel } from "./subcomponent//MapPanel";
import { SimulationForm } from "./subcomponent/SimulationForm";
import type { Entity, RouteData, SimulationParams } from "./types";
import { torontoHealthProviders, cnTowerPos, torontoCentre } from "./utils/baseData";
import { getRouteMatrix, mapMatrixToRoutes } from "./utils/geoapify";
import { formatDistance, formatTime } from "./utils/formatter";



export default function Home() {
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

  const fetchRoutesForPeople = useCallback(async (newPeople: Entity[]) => {
      if (!newPeople.length) return;
      setLoading(true);

      try {
        const matrix = await getRouteMatrix({
          mode: "drive",
          sources: newPeople.map((p) => [p.position[1], p.position[0]]), // lat,lon
          targets: hospitals.map((h) => [h.position[1], h.position[0]])
        });
        const fresh = mapMatrixToRoutes(matrix.sources_to_targets,newPeople,hospitals);
        setRoutes((prev) => [...prev, ...fresh]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [hospitals]
  );


  // incremental peole loading
  const addRandomPeople = useCallback((qty: number) => {
      if (!qty) return;
      const newcomers = generateRandomPointsInRadius(torontoCentre[0],torontoCentre[1],12,qty);
      setPeople(prev => [...prev, ...newcomers]);   // triggers re‑render
      setCount(prev => prev + newcomers.length);
      fetchRoutesForPeople(newcomers);       
      generated.current += newcomers.length;       // only new people
    },
    [fetchRoutesForPeople]
  );

  // ─── launch + paced generation loop ──────────────
  const startSimulation = useCallback((cfg: SimulationParams) => {
    if (isRunning) return;          // guard against double‑click
    if (isRunning) return;
    
    setPeople([]);
    setRoutes([]);
    generated.current = 0;
    cfgRef.current    = cfg;

    setIsRunning(true);
    console.log("simulation started");

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