import React, {useEffect, useMemo, useRef, useState } from "react";
import type { Entity, RouteData, LatLngTuple, HealthProvider, Patient} from "./types";
import { torontoHealthProviders, cnTowerPos, rank } from "./utils/baseData";
import { generatePatient, generatePeopleVariation, randomSeverity } from "./utils/generator";
import { getRouteMatrix } from "./utils/geoapify";
import { formatDistance, formatTime } from "./utils/formatter";
import { MapPanel } from "./subcomponent/MapPanel";
import { PriorityQueue } from "./utils/priorityQueue";

const SIDEMAP_ZOOM = 10;
const CENTRAL_ZOOM = 12;
const BASE_SAMPLE_SIZE = 8;
const SHIFT_DEGREES = 0.01;   // ≈ 1 km each month
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];


type MonthData = {
  label: string;
  people: Patient[];
  routes: RouteData[];
};

const Map: React.FC = () => {
  const hospitals = useMemo<Entity[]>(() =>torontoHealthProviders.slice(0, 6), []);
  const providersRef = useRef<HealthProvider[]>(hospitals.map(h => ({
    name: h.name,
    position: h.position,
    busyness: 0,
    queue: new PriorityQueue<Patient>((a: Patient, b: Patient) => {
      const bySeverity = rank[a.severity] - rank[b.severity];
      return bySeverity !== 0 ? bySeverity : a.arrivalTime - b.arrivalTime;
    }),
  }))).current;

  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buildMonths = async () => {
      try {
        const list: MonthData[] = [];

        let janPeople = generatePatient(BASE_SAMPLE_SIZE);
        const janAssignments = await assignPatientsToProviders(janPeople, providersRef);
        list.push({
          label: "Jan",
          people: janPeople,
          routes: janAssignments
        });
  
        for (let i = 1; i < MONTHS.length; i++) {
          const coordsPrev: LatLngTuple[] = janPeople.map((p) => [p.person.position[1], p.person.position[0]]);
          const coordsNext = generatePeopleVariation(coordsPrev, SHIFT_DEGREES);
          const monthPeople: Patient[] = coordsNext.map((c, idx) => ({
            severity: randomSeverity(),
            person: {
              name: `person ${idx}`,
              position: [c[1], c[0]] as [number, number]
            },
            arrivalTime: Date.now()
          }));
  
          const monthAssignments = await assignPatientsToProviders(monthPeople, providersRef);
          list.push({
            label: MONTHS[i],
            people: monthPeople,
            routes: monthAssignments
          });
          janPeople = monthPeople;
        }
  
        setMonths(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
  
    buildMonths();
  }, [providersRef]);

  const assignPatientsToProviders = async (
    patients: Patient[],
    providers: HealthProvider[]
  ): Promise<RouteData[]> => {
    const matrix = await getRouteMatrix({
      mode: "drive",
      sources: patients.map((p) => [p.person.position[1], p.person.position[0]]),
      targets: providers.map((h) => [h.position[1], h.position[0]])
    });
  
    const assignments: RouteData[] = [];
    matrix.sources_to_targets.forEach((srcRow, srcIdx) => {
      let best: RouteData | null = null;
      srcRow.forEach((tgtCell, tgtIdx) => {
        if (tgtCell.time == null) return;
        if (!best || tgtCell.time < best.travelTime) {
          best = {
            person: patients[srcIdx].person,
            provider: providers[tgtIdx],
            travelTime: tgtCell.time,
            distance: tgtCell.distance
          };
        }
      });
      if (best) assignments.push(best);
    });
    return assignments;
  };

  const allPeople = months.flatMap((m) => m.people);
  const allRoutes = months.flatMap((m) => m.routes);

  return (
    <section className="w-full relative grid grid-cols-4 gap-4 rounded-md bg-gray-100 p-4">
      {loading && (
        <div className="absolute top-[50%] left-[50%] flex flex-col items-center">
          <svg className="h-10 w-10 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4z" />
          </svg>
          <span className="text-md font-semibold">Loading data...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* first row: four monthly side maps */}
          {months.slice(0, 4).map((m) => (
            <div key={m.label} className="relative rounded-md border bg-gray-200">
              <span className="absolute inline-block px-2 py-1 rounded bg-blue-200 opacity-85 bottom-1 left-1 z-[1000] text-sm font-semibold">
                {m.label} data
              </span>
              <MapPanel
                zoom={SIDEMAP_ZOOM}
                cnTowerPos={cnTowerPos}
                people={m.people}
                providers={providersRef}
                routes={m.routes}
                loadingRoutes={false}
                formatTime={formatTime}
                formatDistance={formatDistance}
              />
            </div>
          ))}

          {/* big aggregate map spans 3 columns + 2 rows */}
          <div className="relative col-span-3 row-span-2 rounded-md border bg-gray-200">
            <span className="absolute bottom-1 left-1 nline-block px-2 py-1 rounded bg-blue-200 opacity-85 z-[1000] text-sm font-semibold">
              Jan – Jun aggregate data
            </span>
            <MapPanel
              zoom={CENTRAL_ZOOM}
              cnTowerPos={cnTowerPos}
              people={allPeople}
              providers={providersRef}
              routes={allRoutes}
              loadingRoutes={false}
              formatTime={formatTime}
              formatDistance={formatDistance}
            />
          </div>

          {/* second row: the last two monthly maps */}
          {months.slice(4, 6).map((m) => (
            <div key={m.label} className="relative rounded-md border bg-gray-200">
              <span className="absolute inline-block px-2 py-1 rounded bg-blue-200 opacity-85 bottom-1 left-1 z-[1000] text-sm font-semibold">
                {m.label} data
              </span>
              <MapPanel
                zoom={SIDEMAP_ZOOM}
                cnTowerPos={cnTowerPos}
                people={m.people}
                providers={providersRef}
                routes={m.routes}
                loadingRoutes={false}
                formatTime={formatTime}
                formatDistance={formatDistance}
              />
            </div>
          ))}
        </>
      )}
    
  </section>
  );
};
export default Map;