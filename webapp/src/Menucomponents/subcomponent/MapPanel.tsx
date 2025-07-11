
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip} from "react-leaflet";
import type { HealthProvider, Patient, RouteData, Severity } from "../types";
import { buildDivIcon, CNTowerIcon, HospitalIcon } from "../utils/customIcon";
import React, { useEffect, useRef } from "react";
import { BsPersonRaisedHand } from "react-icons/bs";
import { FaPerson } from "react-icons/fa6";

// , peopleIcon

interface MapPanelProps {
  cnTowerPos: L.LatLngTuple;
  zoom: number;
  people: Patient[];
  providers: HealthProvider[];
  routes: RouteData[];
  loadingRoutes: boolean;
  formatTime: (s?: number) => string;
  formatDistance: (m?: number | null) => string;
}

const severityColorMap: Record<Severity, string> = {
  routine: "#097969",     // green
  moderate: "#fbbf24",    // amber
  severe: "#f97316",      // orange
  critical: "#dc2626"     // red
};
function getCrowdLevel(busyness: number): 0 | 1 | 2 | 3 {
  if (busyness == 0) return 0;
  if (busyness <= 3) return 1;
  if (busyness <= 7) return 2;
  return 3;
}

export const MapPanel: React.FC<MapPanelProps> = ({
  cnTowerPos,
  zoom,
  people,
  providers,
  routes,
  loadingRoutes,
  formatTime,
  formatDistance,
}) => {
  const cnTowerMarkerRef = useRef<L.Marker>(null);

  useEffect(() => {
    cnTowerMarkerRef.current?.openPopup();
  }, []);

  return (
    <MapContainer
      center={cnTowerPos}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full border border-gray-300 rounded-md shadow-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* CN Tower */}
      <Marker position={cnTowerPos} ref={cnTowerMarkerRef} icon={CNTowerIcon}>
        <Tooltip className="text-[14px] max-w-[200px]">
          <strong>Toronto<br />CN Tower</strong>
        </Tooltip>
      </Marker>

      {/* Hospitals Tooltip */}
      {/* p, index key={index} */}
      {providers.map((p, i) => (
        <Marker key={i} position={p.position} icon={HospitalIcon}>
          <Popup className="text-[14px] p-4">
            <div className="flex flex-col justify-center items-center px-2 py-1">
              <div className="flex flex-row">
                <span className="font-semibold">Crowd level: </span>
                {p.busyness ==0 ? ' Empty' :(
                   <div className="person-wrapper ml-2 flex flex-row justify-center items-center"> 
                   {[...Array(getCrowdLevel(p.busyness))].map(() =>
                     <BsPersonRaisedHand  className="busyness-color"/>
                   )} 
                 </div>
                )}
              </div>
              <div className="">
                <span className="font-semibold">Health Insitute:</span>
                <h5 className="text-wrap">{p.name}</h5>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* People & Popups */}
      {/* style={{
            color: caseDescription.find(c => c.severity_level === patient.person..severity)?.color_description
          }} */}
      {people.map((patient, i) => {
        const route = routes.find(r => r.person === patient.person);
        return (
          <Marker key={`person-${i}`} position={patient.person.position} 
            icon={buildDivIcon(
              <FaPerson size={32} style={{ color: severityColorMap[patient.severity] }} />
            )} 
            >
            <Popup className="text-[14px] max-w-[200px]">
              <strong>Person</strong>:{patient.person.name}
              {loadingRoutes && <span className="text-gray-500"> Calculating…</span>}
              {!loadingRoutes && route && (
                <>
                  <br /><strong>Case level</strong>:  <span style={{color: severityColorMap[patient.severity]}}>{patient.severity}</span> 
                  <br /><strong>Nearest</strong>: {route.provider.name}
                  <br /><strong>Time</strong>: {formatTime(route.travelTime)}
                  <br /><strong>Distance</strong>: {formatDistance(route.distance)}
                </>
              )}
            </Popup>
          </Marker>
        );
      })}

      {/* Straight polylines !loadingRoutes && */}
      {routes.map((r, i) => (
        <Polyline
          key={`route-${i}`}
          positions={[r.person.position, r.provider.position]}
          pathOptions={{ weight: 3, dashArray: "4 8", color: "#0047AB", opacity: 0.7 }}
        >
          <Popup className="text-[14px] max-w-[200px]">
            <strong>From:</strong> {r.person.name}<br />
            <strong>To:</strong> {r.provider.name}<br />
            <strong>Time:</strong> {formatTime(r.travelTime)}<br />
            <strong>Distance:</strong> {formatDistance(r.distance)}
          </Popup>
        </Polyline>
      ))}

      {loadingRoutes && (
        <div className="absolute top-3 right-3 bg-gray-300 rounded-md p-3 z-[1000] flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4z" />
          </svg>
          <span className="text-[#003977] text-[14px] font-semibold">Calculating route…</span>
        </div>
      )}
    </MapContainer>
  );
};

// <img src={PersonSVG} key={index} className="z-30 h-15 w-15"/>
{/* <div className="flex flex-col justify-center items-center px-2 py-1">
<div className="mr-2 border flex flex-row justify-center mb-2 w-[120px] "> 
   {[1,2,3].map((p, index) =>
      <BsPersonRaisedHand key={index} />
   )}
</div>
<h5 className="text-wrap text-center font-semibold">{p.name}</h5>
</div> */}