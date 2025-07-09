import React, {useEffect, useMemo, useState } from "react";
import type { Entity, RouteData, LatLngTuple} from "./types";
import { torontoHealthProviders, cnTowerPos, torontoCentre } from "./utils/baseData";
import { generatePeopleVariation, generateRandomPointsInRadius } from "./utils/generator";
import { getRouteMatrix, mapMatrixToRoutes } from "./utils/geoapify";
import { formatDistance, formatTime } from "./utils/formatter";
import { MapPanel } from "./subcomponent/MapPanel";

const SIDEMAP_ZOOM = 10;
const CENTRAL_ZOOM = 12;
const BASE_SAMPLE_SIZE = 8;
const SHIFT_DEGREES = 0.01;          // ≈ 1 km each month
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];


type MonthData = {
    label: string;
    people: Entity[];
    routes: RouteData[];
};

const Map: React.FC = () => {
    const hospitals = useMemo<Entity[]>(() =>torontoHealthProviders.slice(0, 6), []);
    const [months, setMonths] = useState<MonthData[]>([]);
    const [loading, setLoading] = useState(true);

    /** build six months of data once on mount */
    useEffect(() => {
    const buildMonths = async () => {
      try {
        const list: MonthData[] = [];

        /* ---------- 1. JAN (brand‑new random points) ---------- */
        let janPeople = generateRandomPointsInRadius(torontoCentre[0],torontoCentre[1],12,BASE_SAMPLE_SIZE);
        const janMatrix = await getRouteMatrix({
          mode: "drive",
          sources: janPeople.map((p) => [p.position[1], p.position[0]]),
          targets: hospitals.map((h) => [h.position[1], h.position[0]]),
        });
        list.push({
          label: "Jan",
          people: janPeople,
          routes: mapMatrixToRoutes(janMatrix.sources_to_targets, janPeople, hospitals),
        });

        /* ---------- 2‑6. FEB‑JUN (gaussian shift from previous month) ---------- */
        for (let i = 1; i < MONTHS.length; i++) {
          const coordsPrev:LatLngTuple[] = janPeople.map((p) => [p.position[1], p.position[0]]);
          const coordsNext = generatePeopleVariation(coordsPrev, SHIFT_DEGREES);

          const monthPeople = coordsNext.map((c, idx) => ({...janPeople[idx], position: [c[1], c[0]] as [number, number],}));
          const monthMatrix = await getRouteMatrix({
            mode: "drive",
            sources: monthPeople.map((p) => [p.position[1], p.position[0]]),
            targets: hospitals.map((h) => [h.position[1], h.position[0]]),
          });
          list.push({
            label: MONTHS[i],
            people: monthPeople,
            routes: mapMatrixToRoutes(
              monthMatrix.sources_to_targets,
              monthPeople,
              hospitals
            ),
          });
          janPeople = monthPeople; // next loop shifts from this month
        }

        setMonths(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    buildMonths();
  }, [hospitals])
    
  if (loading) return <p>Loading route matrices…</p>;

  /* flatten for the big “aggregate” map */
  const allPeople = months.flatMap((m) => m.people);
  const allRoutes = months.flatMap((m) => m.routes);

    return (
        <section className="w-full grid grid-cols-4 gap-4 rounded-md bg-gray-100 p-4">
      {/* first row: four monthly side maps */}
      {months.slice(0, 4).map((m) => (
        <div key={m.label} className="relative rounded-md border bg-gray-200">
          <span className="absolute bottom-1 left-1 z-[1000] font-semibold">
            {m.label}
          </span>
          <MapPanel
            zoom={SIDEMAP_ZOOM}
            cnTowerPos={cnTowerPos}
            people={m.people}
            providers={hospitals}
            routes={m.routes}
            loadingRoutes={false}
            formatTime={formatTime}
            formatDistance={formatDistance}
          />
        </div>
      ))}

      {/* big aggregate map spans 3 columns + 2 rows */}
      <div className="relative col-span-3 row-span-2 rounded-md border bg-gray-200">
        <span className="absolute bottom-1 left-1 z-[1000] font-semibold">
          Jan – Jun aggregate
        </span>
        <MapPanel
          zoom={CENTRAL_ZOOM}
          cnTowerPos={cnTowerPos}
          people={allPeople}
          providers={hospitals}
          routes={allRoutes}
          loadingRoutes={false}
          formatTime={formatTime}
          formatDistance={formatDistance}
        />
      </div>

      {/* second row: the last two monthly maps */}
      {months.slice(4, 6).map((m) => (
        <div key={m.label} className="relative rounded-md border bg-gray-200">
          <span className="absolute bottom-1 left-1 z-[1000] font-semibold">
            {m.label}
          </span>
          <MapPanel
            zoom={SIDEMAP_ZOOM}
            cnTowerPos={cnTowerPos}
            people={m.people}
            providers={hospitals}
            routes={m.routes}
            loadingRoutes={false}
            formatTime={formatTime}
            formatDistance={formatDistance}
          />
        </div>
      ))}
    </section>
    );
};
export default Map;