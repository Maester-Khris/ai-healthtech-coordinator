import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {MapContainer, TileLayer, Marker, Polyline, Popup} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Person } from "@phosphor-icons/react";
import CNTower from "../assets/cn-tower.png";
import HospitalIc from "../assets/hospital_6395229.png";

type LatLngTuple = [number, number];
type GeoapifyLatLng = [number, number];
type Entity = {
    name: string;
    position: LatLngTuple;
};
interface RouteData {
    person: Entity;
    provider: Entity;
    distance: number; // In meters (from API)
    travelTime: number; // In seconds (from API)
}

const buildDivIcon = (element: React.ReactElement) => L.divIcon({
    html: renderToStaticMarkup(element),
    className: "", // override Leaflet default
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
});
const peopleIcon = buildDivIcon(
    <Person size={32} weight="bold" style={{ color: "#097969" }} />
);
const CNTowerIcon = buildDivIcon(
    <img src={CNTower} style={{height:60,width:60}} alt="cntower" />
);
const HospitalIcon = buildDivIcon(
    <img src={HospitalIc} style={{height:40,width:40}} alt="cntower" />
);


const waterBoxes = [
    [43.60, 43.64, -79.54, -79.40], // Humber Bay
    [43.60, 43.65, -79.40, -79.33], // Inner Harbour / Western Gap
    [43.60, 43.66, -79.33, -79.20], // Outer Harbour / Leslie Spit
];


function generateRandomPointsInRadius(centerLat: number, centerLng: number, radiusKm: number, numPoints: number, maxAttemptsPerPoint: number = 50) {
    const points: Entity[] = [];
    const R = 6371; // Earth's radius in kilometers
    const isRoughlyOnLandToronto = (lat: number, lng: number): boolean => {
        if (lat < 43.59) {
            return false;
        }
        for (const [minLat, maxLat, minLng, maxLng] of waterBoxes) {
            if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
              return false; // inside a water box → reject
            }
        }
        return true;
    };
    let generatedCount = 0;
    while (generatedCount < numPoints) {
        let attempts = 0;
        let foundValidPosition = false;
        while (attempts < maxAttemptsPerPoint && !foundValidPosition) {
            const u = Math.random();
            const distance = radiusKm * Math.sqrt(u);
            const angle = Math.random() * 2 * Math.PI;
            const latRad = (centerLat * Math.PI) / 180;
            const lngRad = (centerLng * Math.PI) / 180;
            const newLatRad = Math.asin(
                Math.sin(latRad) * Math.cos(distance / R) +
                Math.cos(latRad) * Math.sin(distance / R) * Math.cos(angle)
            );
            const newLngRad = lngRad + Math.atan2(
                Math.sin(angle) * Math.sin(distance / R) * Math.cos(latRad),
                Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad)
            );
            const newLat = (newLatRad * 180) / Math.PI;
            const newLng = (newLngRad * 180) / Math.PI;

            // Check if the generated point is on land
            if (isRoughlyOnLandToronto(newLat, newLng)) {
                points.push({ name: `Person ${generatedCount + 1}`, position: [newLat, newLng] });
                foundValidPosition = true;
                generatedCount++;
            }
            attempts++;
        }
        if (!foundValidPosition) {
            console.warn(`Could not find a suitable land position for point ${generatedCount + 1} after ${maxAttemptsPerPoint} attempts. This point will be skipped.`);
            generatedCount++; // Increment to prevent infinite loop if unable to place
        }
    }
    return points;
}

function Home() {
    const cnTowerPosition: LatLngTuple = [43.6426, -79.3871];
    const torontoCentre:   LatLngTuple = [43.6532, -79.3832];
    const initialzoom = 13;
    const initial_lookup_radius = 12;
    const initial_people = 20;
    const GEOAPIFY_API_KEY = "38d52e39400d4a988407942232a566a6";

    const cnTowerMarkerRef = useRef<L.Marker | null>(null);
    useEffect(() => {
        if (cnTowerMarkerRef.current) {
            cnTowerMarkerRef.current.openPopup();
        }
    }, []);

    const healthProviders = useMemo<Entity[]>(() => [
        { name: "Toronto General Hospital (UHN)", position: [43.6575, -79.3875] }, // Approximate
        { name: "Mount Sinai Hospital (Sinai Health)", position: [43.6573, -79.3888] }, // Approximate
        { name: "Hospital for Sick Children (SickKids)", position: [43.6593, -79.3905] }, // Approximate
        { name: "St. Michael's Hospital (Unity Health Toronto)", position: [43.6527, -79.3757] }, // Approximate
        { name: "Sunnybrook Health Sciences Centre", position: [43.7128, -79.3762] }, // Approximate, North York
        { name: "Women's College Hospital", position: [43.6608, -79.3888] },
        { name: "Princess Margaret Cancer Centre (UHN)", position: [43.6568, -79.3879] },
        { name: "Centre for Addiction and Mental Health (CAMH)", position: [43.6454, -79.4087] }, // Queen Street Site
        { name: "Michael Garron Hospital", position: [43.6934, -79.3082] }, // East York
        { name: "Humber River Hospital", position: [43.7196, -79.5229] } // North-West Toronto
    ], []);
    const [peoplesPositions] = useState<Entity[]>(() => 
        generateRandomPointsInRadius(
            torontoCentre[0], torontoCentre[1], 
            initial_lookup_radius, initial_people
        )   
    );

    const [routesToProviders, setRoutesToProviders] = useState<RouteData[]>([]);
    const [loadingRoutes, setLoadingRoutes] = useState(true);

    // Function to format time for display
    const formatTime = useCallback((seconds: number | undefined): string => {
        if (seconds == null) return 'N/A';
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `${hours} hr ${minutes % 60} min`;
    }, []);


    const formatDistance = (meters: number | null | undefined) =>
        meters == null ? 'N/A' : `${(meters / 1000).toFixed(2)} km`;
    
    // useEffect(() => {
    const fetchRoutes = useCallback( async () => {

        setLoadingRoutes(true);
        console.log("fetch route started... stage 1");
        const newRoutes: RouteData[] = [];
        const sourcesForApi = peoplesPositions.map(p => ({
            location: [p.position[1], p.position[0]] as GeoapifyLatLng
        }));
        const targetsForApi = healthProviders.map(hp => ({
            location: [hp.position[1], hp.position[0]] as GeoapifyLatLng
        }));

        const batchdata = JSON.stringify({
            "mode": "drive", // Or "walk", "bike" etc.
            "sources": sourcesForApi,
            "targets": targetsForApi
        });

        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        const requestOptions = {
            method: 'POST',
            headers: myHeaders,
            body: batchdata
        };

        try {
            const response = await fetch(`https://api.geoapify.com/v1/routematrix?apiKey=${GEOAPIFY_API_KEY}`, requestOptions);
            console.log("fetch route started... stage 2 response received");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Geoapify API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            // Process the response to find the closest provider for each person
            result.sources_to_targets.forEach((sourceData: any[], sourceIndex: number) => {
                const person = peoplesPositions[sourceIndex];
                let closestProvider: Entity | null = null;
                let minTime = Infinity;
                let bestDistance = Infinity; // Also track distance for display
                sourceData.forEach((targetInfo: any, targetIndex: number) => {
                    if (targetInfo.time == null || targetInfo.distance == null) return;
                    if (targetInfo.time < minTime) {
                        minTime = targetInfo.time;
                        bestDistance = targetInfo.distance;
                        closestProvider = healthProviders[targetIndex];
                    }
                });
                if (closestProvider && minTime !== Infinity) {
                    newRoutes.push({
                        person: person,
                        provider: closestProvider,
                        travelTime: minTime,
                        distance: bestDistance
                    });
                } else {
                    console.warn(`No valid route found for source index ${sourceIndex}. This person might be skipped.`);
                }
            });
            setRoutesToProviders(newRoutes);
            
        } catch (error) {
            console.error('Error fetching Geoapify Route Matrix:',error);
        } finally {
            setLoadingRoutes(false);
        }
    },[GEOAPIFY_API_KEY, peoplesPositions, healthProviders]);
        

    useEffect(() => {
        fetchRoutes();          // fires once (unless the API key or inputs change)
    }, [fetchRoutes]);

    return (
        <section className="w-full flex justify-center rounded-md bg-gray-100 p-4">
            <MapContainer center={cnTowerPosition} zoom={initialzoom} scrollWheelZoom={false}
                className="h-full w-full border border-gray-300 rounded-md shadow-md"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={cnTowerPosition} ref={cnTowerMarkerRef} icon={CNTowerIcon}>
                    <Popup className="text-[14px] max-w-[200px]">
                        <strong>Toronto <br /> CN Tower. </strong>
                    </Popup>
                </Marker>

                {healthProviders.map((provider, index) => (
                    <Marker key={index} position={provider.position} icon={HospitalIcon}>
                        <Popup className="text-[14px] max-w-[200px]">
                            <strong>{provider.name}</strong>
                        </Popup>
                    </Marker>
                ))}

                {peoplesPositions.map((person, index) => {
                    const routeInfo = routesToProviders.find(route => route.person === person);
                    return (
                        <Marker key={`person-${index}`} position={person.position} icon={peopleIcon}>
                            <Popup className="text-[14px] max-w-[200px]">
                                <strong>{person.name || `Person ${index + 1}`} </strong>
                                {loadingRoutes && (
                                    <>
                                        <span style={{ color: 'gray' }}>Calculating route...</span>
                                    </>
                                )}
                                {!loadingRoutes && routeInfo && (
                                    <>
                                        <br />
                                      <strong>Nearest</strong>: {routeInfo.provider.name}
                                        <br />
                                        <strong>Travel Time</strong>: {formatTime(routeInfo.travelTime)}
                                        <br />
                                        <strong>Travel Distance</strong>: {(routeInfo.distance / 1000).toFixed(2)} km
                                    </>
                                )}
                                {!loadingRoutes && !routeInfo && (
                                    <>
                                        <br /><span style={{ color: 'gray' }}>No route info available.</span>
                                    </>
                                )}
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Render the polylines (straight lines as matrix API doesn't provide geometry) */}
                {!loadingRoutes && routesToProviders.map((route, index) => (
                    <Polyline
                        key={`route-${index}`}
                        positions={[route.person.position, route.provider.position]}
                        pathOptions={{ weight: 3, dashArray: "4 8", color: "#0047AB", opacity: 0.7 }}
                    >
                        <Popup className="text-[14px] max-w-[200px]">
                            <strong>From</strong>: {route.person.name} <strong>To</strong>: {route.provider.name}<br />
                            <strong>Travel Time</strong>: {formatTime(route.travelTime)}<br />
                            <strong>Travel Distance</strong>: {formatDistance(route.distance)}
                        </Popup>
                    </Polyline>
                ))}

                {loadingRoutes && (
                    <div className="bg-gray-300 rounded-md absolute top-[10px] right-[10px] p-3 z-1000">
                        <svg
                        className="mr-3 h-5 w-5 animate-spin text-blue-600 inline-block"
                        viewBox="0 0 24 24"
                        fill="none"               
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"
                        />
                        <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4z"
                        />
                    </svg>
                        <span className="text-[#003977] text-[14px] font-semibold">Calculating route...</span>
                    </div>
                )}
            </MapContainer>
        </section>
    )
}

export default Home


// if (GEOAPIFY_API_KEY === "38d52e39400d4a988407942232a566a6" || peoplesPositions.length === 0 || healthProviders.length === 0) {
//     console.warn("Please set your Geoapify API key and ensure people/providers data exists.");
//     setLoadingRoutes(false);
//     return;
// }


// generator(){
//     const points: Entity[] = [];
//     const R = 6371; // Earth's radius in kilometers

//     for (let i = 0; i < numPoints; i++) {
//         // Generate a random distance from the center (within the radius)
//         const u = Math.random(); // Uniform random number [0, 1)
//         const distance = radiusKm * Math.sqrt(u); // Distribute points more evenly by using sqrt

//         // Generate a random angle (0 to 2*PI)
//         const angle = Math.random() * 2 * Math.PI;

//         // Calculate new latitude and longitude
//         const latRad = (centerLat * Math.PI) / 180;
//         const lngRad = (centerLng * Math.PI) / 180;

//         const newLatRad = Math.asin(
//             Math.sin(latRad) * Math.cos(distance / R) +
//             Math.cos(latRad) * Math.sin(distance / R) * Math.cos(angle)
//         );

//         const newLngRad = lngRad + Math.atan2(
//             Math.sin(angle) * Math.sin(distance / R) * Math.cos(latRad),
//             Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad)
//         );

//         const newLat = (newLatRad * 180) / Math.PI;
//         const newLng = (newLngRad * 180) / Math.PI;
//         points.push({name:"", position:[newLat, newLng]});
//     }

//     return points;
// }

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