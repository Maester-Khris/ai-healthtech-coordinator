import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePatient, generateRandomPointsInRadius } from "./utils/generator";
import { MapPanel } from "./subcomponent//MapPanel";
import { SimulationForm } from "./subcomponent/SimulationForm";
import type { Entity, HealthProvider, Patient, RouteData, Severity, SimulationParams } from "./types";
import { torontoHealthProviders, cnTowerPos, torontoCentre } from "./utils/baseData";
import { getRouteMatrix, mapMatrixToRoutes } from "./utils/geoapify";
import { formatDistance, formatTime } from "./utils/formatter";
import { PriorityQueue } from "./utils/priorityQueue";

const rank: Record<Severity, number> = {
  critical: 0,
  severe: 1,
  moderate: 2,
  routine: 3,
};

export default function Home() {
  const hospitals = useMemo<Entity[]>(() =>torontoHealthProviders, []);
  const providersRef = useRef<HealthProvider[]>(hospitals.map(h => ({
      name: h.name,
      position: h.position,
      busyness: 0,
      queue: new PriorityQueue<Patient>((a: Patient, b: Patient) => {
        const bySeverity = rank[a.severity] - rank[b.severity];
        return bySeverity !== 0 ? bySeverity : a.arrivalTime - b.arrivalTime;
      }),
    }))).current;

    

  // const [people, setPeople]       = useState<Entity[]>([]);  
  const [people, setPeople]       = useState<Patient[]>([]);   // start empty
  const [routes, setRoutes]       = useState<RouteData[]>([]);
  const [peopleCount, setCount] = useState(0);          // NEW
  const [timeLeft, setLeft]     = useState(0);  
  const [loading, setLoading]     = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const simTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cfgRef    = useRef<SimulationParams | null>(null);
  const generated = useRef(0);              // running tally  

  //const fetchRoutesForPeople = useCallback(async (newPeople: Entity[]) => 
  // const fresh = mapMatrixToRoutes(matrix.sources_to_targets,newPeople,hospitals);
  // setRoutes((prev) => [...prev, ...fresh]);
  const fetchRoutesForPeople = useCallback(async (newPatients: Patient[]) => {
      if (!newPatients.length) return;
      setLoading(true);

      try {
        const matrix = await getRouteMatrix({
          mode: "drive",
          sources: newPatients.map((p) => [p.person.position[1], p.person.position[0]]), // lat,lon
          targets: providersRef.map((h) => [h.position[1], h.position[0]])
        });
        
        //use matrix.source_to_target to add route between patient and health provider using their position
        const assignments: RouteData[] = [];
        matrix.sources_to_targets.forEach((srcRow, srcIdx) => {
          let best: RouteData | any = null;
    
          srcRow.forEach((tgtCell, tgtIdx) => {
            if (tgtCell.time == null) return; // unreachable
            if (!best || tgtCell.time < best.travelTime) {
              best = {
                person: newPatients[srcIdx].person,
                provider: {
                  name: providersRef[tgtIdx].name,
                  position: providersRef[tgtIdx].position
                },
                travelTime: tgtCell.time,
                distance: tgtCell.distance
              };
            }
          });
    
          if (best) {
            assignments.push(best);
            // Update provider's queue
            const patient = newPatients[srcIdx];
            const targetProvider = providersRef.find(p => p.name === best!.provider.name);
            if (targetProvider) {
              // Simulate ETA
              patient.arrivalTime = Date.now() + best.travelTime * 1000;
              targetProvider.queue.enqueue(patient);
              targetProvider.busyness = targetProvider.queue.size();
            }
          }
        });
    
        setRoutes(prev => [...prev, ...assignments]);
        


      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [providersRef]
  );


  // incremental peole loading
  const addRandomPeople = useCallback((qty: number) => {
      if (!qty) return;
      //const newcomers = generateRandomPointsInRadius(torontoCentre[0],torontoCentre[1],12,qty);
      const newcomers:Patient[] = generatePatient(qty); 
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
          providers={providersRef}
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