import { SimulationForm } from './subcomponent/SimulationForm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BsPersonRaisedHand } from "react-icons/bs";
import { PriorityQueue } from './utils/priorityQueue';
import type { Entity, Patient, Severity, HealthProvider, SimulationParams } from './types';
import { torontoHealthProviders } from './utils/baseData';
import { generatePatient } from './utils/generator';
import { getRouteMatrix } from './utils/geoapify';



function Inhousescheduler() {

  const cfgRef    = useRef<SimulationParams | null>(null);
  const generated = useRef(0);              // running tally 
  const simTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null); 

  const [patient, setPatient] = useState<Patient[]>([]);   // start empty
  const [peopleCount, setCount] = useState(0);          
  const [timeLeft, setLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);


  const rank: Record<Severity, number> = {
    critical: 0,
    severe: 1,
    moderate: 2,
    routine: 3,
  };
  const caseDescription: any[] = [
    { severity_level: "routine", color_description: "#28A745" }, // Green (Success/Normal)
    { severity_level: "moderate", color_description: "#FFC107" }, // Yellow/Orange (Warning)
    { severity_level: "severe", color_description: "#FD7E14" }, // Dark Orange/Light Red (Higher Warning/Alert)
    { severity_level: "critical", color_description: "#DC3545" }  // Red (Danger/Error)
  ];

  const hospitals = useMemo<Entity[]>(() => torontoHealthProviders.slice(0,6),[]);

  const providersRef = useRef<HealthProvider[]>(hospitals.map(h => ({
    name: h.name,
    position: h.position,
    busyness: 0,
    queue: new PriorityQueue<Patient>((a: Patient, b: Patient) => {
      const bySeverity = rank[a.severity] - rank[b.severity];
      return bySeverity !== 0 ? bySeverity : a.arrivalTime - b.arrivalTime;
    }),
  }))).current;

  const admitPeople = useCallback(async (qt_people_generated:number)=>{
    let patients:Patient[] = generatePatient(qt_people_generated);
    setPatient(prev => [...prev, ...patients]);   // triggers re‑render
    
    try{
      const matrix = await getRouteMatrix({
        mode: "drive",
        sources: patients.map((p) => [p.person.position[1], p.person.position[0]]), // lat,lon
        targets: providersRef.map((h) => [h.position[1], h.position[0]])
      });

      //from the matrix response add each patient to the provider queu
      matrix.sources_to_targets.forEach((distances, patientIndex) => {
        let minDistance = Infinity;
        let closestProviderIndex = -1;
  
        distances.forEach((entry, providerIndex) => {
          if (entry.distance !== null && entry.distance < minDistance) {
            minDistance = entry.distance;
            closestProviderIndex = providerIndex;
          }
        });
  
        if (closestProviderIndex !== -1) {
          const provider = providersRef[closestProviderIndex];
          provider.queue.enqueue(patients[patientIndex]);
          setCount(prev => prev + 1);
          provider.busyness = provider.queue.size(); // Update for UI
        }
      });
    }catch (error) {
      console.error("Error in admitPeople:", error);
    }
  }, []);


  const startSimulation = useCallback((cfg: SimulationParams) => {
    if (isRunning) return;
    
    //reset local data
    setPatient([]);
    console.log(patient);
    providersRef.forEach((prov) => {
      prov.queue.clear?.();           
      prov.busyness = 0;             
    });

    generated.current = 0;
    cfgRef.current    = cfg;

    setIsRunning(true);
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
      admitPeople(qty);

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


  }, [admitPeople, isRunning]);


  const stopSimulation = useCallback(() => {
    simTimer.current && clearTimeout(simTimer.current);
    countdownRef.current && clearInterval(countdownRef.current);
    countdownRef.current = null;
    simTimer.current = null;
    cfgRef.current   = null;

    setIsRunning(false);
    setLeft(0);
    setCount(0);
  }, []);

  /* cleanup when component unmounts */
  useEffect(() => () => stopSimulation(), [stopSimulation]);

  return (
    <section className="w-full min-h-screen grid grid-cols-8 gap-3">
      <div className="h-full col-span-6 p-4 bg-gray-100 rounded-md">
        <div className="grid grid-cols-3 grid-rows-2 gap-6 h-full">
          {providersRef.map((prov) => (
            <div key={prov.name} className="border border-gray-600 bg-gray-300 rounded-md py-3 flex flex-col items-center justify-center h-full">
              <div className='w-full border-b border-black mb-2'>
                <h3 className="text-center font-semibold">{prov.name.length>25 ? prov.name.slice(0,25) + ' ...' : prov.name}</h3>
              </div>
              {/* queue list */}
              <div className="flex-grow w-full overflow-y-auto no-scrollbar px-3">
                {prov.queue.peek() ? (
                  prov.queue           // convert to array for render
                    .toSortedArray()         // add this helper in priorityQueue if you want
                    .map((pat, i) => (
                      <div key={i} className="mb-2 flex items-center justify-between rounded bg-white px-4 py-2">
                        <div className='flex flex-row items-center'>
                          <BsPersonRaisedHand size={20} className="mr-2"
                           style={{
                            color: caseDescription.find(c => c.severity_level === pat.severity)?.color_description
                          }}
                          />
                          <span>{pat.person.name.length > 12 ? pat.person.name.slice(0, 17) + "..." : pat.person.name}</span>
                        </div>
                        <span className="lowercase font-semibold" style={{
                            color: caseDescription.find(c => c.severity_level === pat.severity)?.color_description
                          }}>
                            {pat.severity}
                          </span>
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