import { SimulationForm } from './subcomponent/SimulationForm'
import { useCallback, useMemo, useRef, useState } from 'react'
import { PriorityQueue } from './utils/priorityQueue';
import type { Entity, Patient, Severity, HealthProvider } from './types';
import { torontoHealthProviders } from './utils/provierdata';


//const GEOAPIFY_API_KEY = "38d52e39400d4a988407942232a566a6";

function Inhousescheduler() {
  // const [patient, setPatient] = useState<Patient[]>([]);
  const [peopleCount, setCount] = useState(0);          // NEW
  const [timeLeft, setLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  //const [, setVersion] = useState(0);

  // const arrivalsId = useRef<NodeJS.Timeout | null>(null);
  // const serviceId = useRef<NodeJS.Timeout | null>(null);

  const rank: Record<Severity, number> = {
    critical: 0,
    severe: 1,
    moderate: 2,
    routine: 3,
  };

  const hospitals = useMemo<Entity[]>(() => torontoHealthProviders,[]);

  const providersRef = useRef<HealthProvider[]>(hospitals.map(h => ({
    name: h.name,
    position: h.position,
    busyness: 0,
    queue: new PriorityQueue<Patient>((a: Patient, b: Patient) => {
      const bySeverity = rank[a.severity] - rank[b.severity];
      return bySeverity !== 0 ? bySeverity : a.arrivalTime - b.arrivalTime;
    }),
  }))).current;

  // const admitPatient = useCallback(async (patients: Patient[]) => {
  //   if (!patients.length) return;
  //   //use the list of patient with their position and the list of provider with their position
  //   //determine for each of them the closest and add patient to respective provider queue
  //   try {
  //     let providerpos: LatLngTuple[] = providersRef.map(p => p.position);
  //     const body = JSON.stringify({
  //       mode: "drive",
  //       sources: patients.map(p => ({ location: [p.person.position[1], p.person.position[0]] })),
  //       targets: providerpos.map(hpos => ({ location: [hpos[1], hpos[0]] })),
  //     });
  //     const res = await fetch(`https://api.geoapify.com/v1/routematrix?apiKey=${GEOAPIFY_API_KEY}`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body,
  //     });
  //     if (!res.ok) throw new Error(await res.text());

  //     const data = await res.json();
  //     data.sources_to_targets.forEach(
  //       (row: { distance: number | null; target_index: number }[], srcIdx: number) => {
  //         // skip completely unreachable rows (all distances null)
  //         const reachable = row.filter(c => c.distance != null);
  //         if (!reachable.length) return;
  //         // distance is in metres; the *smallest* wins
  //         const closest = reachable.reduce((best, cur) =>
  //           cur.distance! < best.distance! ? cur : best
  //         );
  //         const patient = patients[srcIdx];
  //         const provider = providersRef[closest.target_index];
  //         provider.queue.enqueue(patient);
  //         provider.busyness = provider.queue.size();
  //       }
  //     );
  //     /* ---- 3. Force a re‑render so UI shows new queue sizes ---- */
  //     setVersion(v => v + 1);   // see tweak #2 below

  //   } catch (e) {
  //     console.error(e);
  //   } finally {

  //   }
  // }, [providersRef]);

  // const addPatient = useCallback(
  //   async (qty: number) => {
  //     if (!qty) return;
  //     const newcomers = generatePatient(qty);      // <‑‑ random patients
  //     await admitPatient(newcomers);               // ← IMPORTANT
  //     setPatient(prev => [...prev, ...newcomers]); // render dots/markers etc.
  //   },
  //   [admitPatient]
  // );

  // const TIMER_MS = 800;           // adjust speed here

  const startSimulation = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    // ...
  }, [isRunning]);

  const stopSimulation = useCallback(() => {
    setIsRunning(false);
    setLeft(0);
    setCount(0);
    //..
  }, []);

  // const caseDescription: any[] = [
  //   { severity_level: "routine", color_description: "#28A745" }, // Green (Success/Normal)
  //   { severity_level: "moderate", color_description: "#FFC107" }, // Yellow/Orange (Warning)
  //   { severity_level: "severe", color_description: "#FD7E14" }, // Dark Orange/Light Red (Higher Warning/Alert)
  //   { severity_level: "critical", color_description: "#DC3545" }  // Red (Danger/Error)
  // ];

  return (
    <section className="w-full grid grid-cols-8 gap-3">
      <div className="col-span-6 p-4 bg-gray-100 rounded-md">
        <div className="grid grid-cols-3 grid-rows-2 gap-6">
          {providersRef.map((prov) => (
            <div key={prov.name} className="h-[300px] border border-gray-600 bg-gray-300 rounded-md py-3 flex flex-col items-center justify-center">
              <div className='w-full border-b border-black px-3 mb-2'>
                <h3 className="text-center font-semibold">{prov.name}</h3>
              </div>
              {/* queue list */}
              <div className="h-full overflow-y-auto px-3">
                {prov.queue.peek() ? (
                  prov.queue           // convert to array for render
                    .toArray()         // add this helper in priorityQueue if you want
                    .map((pat, i) => (
                      <div key={i} className="mb-2 flex items-center justify-between rounded bg-blue-400 px-4 py-2">
                        <span>{pat.person.name}</span>
                        <span className="capitalize">{pat.severity}</span>
                      </div>
                    ))) : (
                  <p className="text-center text-sm mt-6 italic text-gray-700">No patients</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-2">
        <SimulationForm
          isRunning={isRunning}
          onLaunch={startSimulation}
          onStop={stopSimulation}
          peopleCount={peopleCount}
          timeLeftMs={timeLeft}
        />
      </div>
    </section>

  )
}

export default Inhousescheduler

{/* {providersRef.map((provider, index) => (
  <div key={index}
    className="h-[300px] min-h-0 border border-gray-600 
      bg-gray-300 rounded-md py-3 flex flex-col items-center justify-center">
    
    <div className='w-full border-b border-black px-3 mb-2'>
      <h3 className="mx-auto text-center font-semibold">{provider.name}</h3>
    </div>
    
    <div className="h-full w-full px-3 flex flex-col overflow-y-auto no-scrollbar">
      {[...Array(12)].map((_, i) => (
        <div key={i}
          className="mb-3 flex w-full items-center justify-between 
            rounded-md bg-blue-400 px-6 py-3 outline-blue-600">
          <div>
            <PersonSimpleCircle size={32} weight="bold" className="mr-3 inline-block" />
            <span className="text-sm font-semibold">Person N°{i + 1}</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm">severe</span>
            <span className="ml-2 h-3 w-3 rounded-full bg-yellow-300"></span>
          </div>
        </div>
      ))}
    </div>
  </div>
))} */}