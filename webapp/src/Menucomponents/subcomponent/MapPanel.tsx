
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip} from "react-leaflet";
import type { Entity, RouteData } from "../types";
import { CNTowerIcon, HospitalIcon, peopleIcon } from "../utils/customIcon";
import React, { useEffect, useRef } from "react";

interface MapPanelProps {
  cnTowerPos: L.LatLngTuple;
  zoom: number;
  people: Entity[];
  providers: Entity[];
  routes: RouteData[];
  loadingRoutes: boolean;
  formatTime: (s?: number) => string;
  formatDistance: (m?: number | null) => string;
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

      {/* Hospitals */}
      {providers.map((p, i) => (
        <Marker key={i} position={p.position} icon={HospitalIcon}>
          <Tooltip className="text-[14px] p-4">
            <strong>{p.name}</strong>
          </Tooltip>
        </Marker>
      ))}

      {/* People & Popups */}
      {people.map((person, i) => {
        const route = routes.find(r => r.person === person);
        return (
          <Marker key={`person-${i}`} position={person.position} icon={peopleIcon}>
            <Popup className="text-[14px] max-w-[200px]">
              <strong>{person.name}</strong>
              {loadingRoutes && <span className="text-gray-500"> Calculating…</span>}
              {!loadingRoutes && route && (
                <>
                  <br /><strong>Nearest:</strong> {route.provider.name}
                  <br /><strong>Time:</strong> {formatTime(route.travelTime)}
                  <br /><strong>Distance:</strong> {formatDistance(route.distance)}
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
