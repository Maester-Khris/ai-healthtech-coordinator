import React, { useMemo } from "react";
// import * as turf from '@turf/turf'; 
import {
    MapContainer,
    TileLayer,
    Marker,
    Polyline,
    Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaUser, FaClinicMedical } from "react-icons/fa";
import { renderToStaticMarkup } from "react-dom/server";


type LatLngTuple = [number, number];
type Entity = {
    id: string;
    name: string;
    position: LatLngTuple;
};
type Edge = {
    personId: string;
    providerId: string;
    coords: LatLngTuple[];
};

/** Bounding box that roughly fits the City of Toronto */
// const BOUNDS = {
//     north: 43.8555,
//     south: 43.57, // A bit more conservative, but still just a bounding box for initial random generation
//     west: -79.6393,
//     east: -79.1169,
// };
// const randomInRange = (min: number, max: number) =>
//     Math.random() * (max - min) + min;

// const randomCoord = (): LatLngTuple => [
//     randomInRange(BOUNDS.south, BOUNDS.north),
//     randomInRange(BOUNDS.west, BOUNDS.east),
// ];


/** Helper to turn a React‑Icon into a Leaflet DivIcon */
const buildDivIcon = (element: React.ReactElement) =>
    L.divIcon({
        html: renderToStaticMarkup(element),
        className: "", // override Leaflet default
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
    });

const personIcon = buildDivIcon(
    <FaUser size={28} style={{ color: "#2563eb" }} />,
);
const providerIcon = buildDivIcon(
    <FaClinicMedical size={28} style={{ color: "#dc2626" }} />,
);
// Icon for identified underserved cluster centroids
// const clusterIcon = new L.Icon({
//     iconUrl: 'https://cdn-icons-png.flaticon.com/512/5766/5766023.png', // Example: a target or hotspot icon
//     iconSize: [40, 40],
//     iconAnchor: [20, 40],
//     popupAnchor: [0, -40],
// });


const haversine = (coord1: [number, number], coord2: [number, number]): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3; // metres
    const lat1 = toRad(coord1[0]);
    const lon1 = toRad(coord1[1]);
    const lat2 = toRad(coord2[0]);
    const lon2 = toRad(coord2[1]);
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in meters
};

const gaussianRandom = (mean = 0, stdev = 1) => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdev + mean;
};

// Function to generate a single variation of people's positions
// It introduces small, "realistic" random shifts to the base positions.
// The `shiftMagnitude` controls how much points can move.
const generatePeopleVariation = (
    basePeopleCoords: LatLngTuple[],
    shiftMagnitude: number = 0.005 // A small value, e.g., 0.005 degrees latitude/longitude (approx 500-600 meters)
): LatLngTuple[] => {
    return basePeopleCoords.map(coord => {
        const [lat, lng] = coord;
        const newLat = lat + gaussianRandom(0, shiftMagnitude / 3);
        const newLng = lng + gaussianRandom(0, shiftMagnitude / 3);
        return [newLat, newLng];
    });
};


const Map: React.FC = () => {

    const staticProviderCoords: LatLngTuple[] = [
        [43.75, -79.40],  // North York (moved slightly NE)
        [43.80, -79.30],  // Scarborough North (moved NE)
        [43.70, -79.28],  // East York / Danforth area (moved NE)
        [43.68, -79.35],  // Downtown Core (moved slightly NE, still central)
        [43.66, -79.38],  // Closer to Yonge/Bloor (moved NE from original Liberty Village)
        [43.72, -79.50],  // Etobicoke North (moved slightly NE within Etobicoke)
        [43.82, -79.15],  // Scarborough East (moved further NE)
        [43.63, -79.45],  // Central Etobicoke (moved north from Mimico)
        [43.78, -79.35],  // North York Central (moved NE)
        [43.69, -79.48],  // Etobicoke Central (moved NE)
    ];

    const basePeopleCoords: LatLngTuple[] = [
        // Central / Downtown Toronto (shifted slightly NE)
        [43.67, -79.38],
        [43.68, -79.37],
        [43.66, -79.35],
        [43.69, -79.40],
        [43.70, -79.33],

        // North York / Uptown (shifted NE)
        [43.77, -79.36],
        [43.74, -79.40],
        [43.72, -79.38],
        [43.78, -79.43],
        [43.81, -79.35],

        // Scarborough (shifted NE)
        [43.79, -79.23],
        [43.77, -79.16],
        [43.78, -79.18],
        [43.84, -79.26],
        [43.82, -79.20],

        // Etobicoke / West Toronto (shifted NE, away from lake)
        [43.64, -79.52],
        [43.70, -79.48],
        [43.62, -79.50],
        [43.66, -79.56], // Closer to Mississauga border (moved north)
        [43.71, -79.53],

        // Further out (Vaughan, Markham, Pickering - shifted NE)
        [43.87, -79.48], // Vaughan (moved NE)
        [43.90, -79.28], // Markham (moved NE)
        [43.85, -79.08], // Pickering (moved NE, further east)
        [43.72, -79.58], // Brampton/Mississauga border (moved NE)
        [43.83, -79.40], // Richmond Hill / Vaughan border (moved NE)
    ];

    // Define the number of map variations you want to display
    const numberOfVariations = 4; // Including the base map, so 3 additional variations

    const allMapData = useMemo(() => {
        const generatedData = [];

        // First map: The base map with the initial staticPeopleCoords
        const providersBase: Entity[] = staticProviderCoords.map((coord, i) => ({
            id: `prov-${i}`,
            name: `Provider ${i + 1}`,
            position: coord,
        }));

        const peopleBase: Entity[] = basePeopleCoords.map((coord, i) => ({
            id: `person-${i}`,
            name: `Person ${i + 1}`,
            position: coord,
        }));

        const edgesBase: Edge[] = peopleBase.map((p) => {
            let nearest = providersBase[0];
            let bestDist = haversine(p.position, nearest.position);

            for (const prov of providersBase.slice(1)) {
                const d = haversine(p.position, prov.position);
                if (d < bestDist) {
                    bestDist = d;
                    nearest = prov;
                }
            }
            return { personId: p.id, providerId: nearest.id, coords: [p.position, nearest.position] };
        });
        generatedData.push({ providers: providersBase, people: peopleBase, edges: edgesBase, title: "Base Map (Time 0)" });


        // Generate additional variations
        for (let i = 1; i < numberOfVariations; i++) {
            const currentProviders: Entity[] = providersBase; // Providers remain static

            const currentPeopleCoords = generatePeopleVariation(basePeopleCoords, 0.007); // Slightly larger shift for variations
            const currentPeople: Entity[] = currentPeopleCoords.map((coord, idx) => ({
                id: `person-${idx}`,
                name: `Person ${idx + 1}`,
                position: coord,
            }));

            const currentEdges: Edge[] = currentPeople.map((p) => {
                let nearest = currentProviders[0];
                let bestDist = haversine(p.position, nearest.position);

                for (const prov of currentProviders.slice(1)) {
                    const d = haversine(p.position, prov.position);
                    if (d < bestDist) {
                        bestDist = d;
                        nearest = prov;
                    }
                }
                return { personId: p.id, providerId: nearest.id, coords: [p.position, nearest.position] };
            });

            generatedData.push({
                providers: currentProviders,
                people: currentPeople,
                edges: currentEdges,
                title: `Map Variation (Time +${i})`
            });
        }

        return generatedData;
    }, []); // Empty dependency array as providers are static and basePeopleCoords are fixed

    // return (
    //     <section className="w-full flex flex-wrap justify-center rounded-md bg-gray-100 py-10 px-4 gap-4">
    //         {allMapData.map((mapData, mapIndex) => (
    //             <div key={mapIndex} className="w-full md:w-[48%] lg:w-[48%] flex flex-col items-center">
    //                 <h3 className="text-lg font-semibold mb-2">{mapData.title}</h3>
    //                 <MapContainer
    //                     center={[43.72, -79.34]} // Consistent center for all maps
    //                     zoom={10} // Consistent zoom for all maps
    //                     scrollWheelZoom
    //                     className="h-[400px] w-full border border-gray-300 rounded-md shadow-md" // Smaller, fixed size for side-by-side
    //                 >
    //                     <TileLayer
    //                         attribution="&copy; OpenStreetMap contributors"
    //                         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    //                     />

    //                     {mapData.providers.map((prov) => (
    //                         <Marker key={prov.id} position={prov.position} icon={providerIcon}>
    //                             <Popup>{prov.name}</Popup>
    //                         </Marker>
    //                     ))}

    //                     {mapData.people.map((pers) => (
    //                         <Marker key={pers.id} position={pers.position} icon={personIcon}>
    //                             <Popup>{pers.name}</Popup>
    //                         </Marker>
    //                     ))}

    //                     {mapData.edges.map((edge, idx) => (
    //                         <Polyline
    //                             key={idx}
    //                             positions={edge.coords}
    //                             pathOptions={{ weight: 3, dashArray: "4 8", color: "#10b981" }}
    //                         />
    //                     ))}
    //                 </MapContainer>
    //             </div>
    //         ))}
    //     </section>
    // );
    return (
        <section className="w-full flex justify-center rounded-md bg-gray-100 py-10 px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                {allMapData.map((mapData, mapIndex) => (
                    <div key={mapIndex} className="flex flex-col items-center">
                        <h3 className="text-lg font-semibold mb-2">{mapData.title}</h3>
                        <MapContainer
                            center={[43.72, -79.34]} 
                            zoom={9.5} 
                            scrollWheelZoom
                            className="h-[400px] w-full border border-gray-300 rounded-md shadow-md" // Smaller, fixed size for side-by-side
                        >
                            <TileLayer
                                attribution="&copy; OpenStreetMap contributors"
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {mapData.providers.map((prov) => (
                                <Marker key={prov.id} position={prov.position} icon={providerIcon}>
                                    <Popup>{prov.name}</Popup>
                                </Marker>
                            ))}

                            {mapData.people.map((pers) => (
                                <Marker key={pers.id} position={pers.position} icon={personIcon}>
                                    <Popup>{pers.name}</Popup>
                                </Marker>
                            ))}

                            {mapData.edges.map((edge, idx) => (
                                <Polyline
                                    key={idx}
                                    positions={edge.coords}
                                    pathOptions={{ weight: 3, dashArray: "4 8", color: "#10b981" }}
                                />
                            ))}
                        </MapContainer>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Map;

