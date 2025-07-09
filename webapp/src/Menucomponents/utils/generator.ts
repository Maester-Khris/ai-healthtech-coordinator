import type { Entity, Severity, Patient, LatLngTuple } from "../types";

const waterBoxes = [
  [43.60, 43.64, -79.54, -79.40], // Humber Bay
  [43.60, 43.65, -79.40, -79.33], // Inner Harbour
  [43.60, 43.66, -79.33, -79.20], // Outer Harbour
];

// ==================================== Entity generation =======================================
function randomSeverity(): Severity {
  const p = Math.random();
  if (p < 0.05) return 'critical';
  if (p < 0.20) return 'severe';
  if (p < 0.55) return 'moderate';
  return 'routine';
}
export function generatePatient(qty:number):Patient[]{
  const torontoCentre: [number, number] = [43.6532, -79.3832];
  //generateRandomPointsInRadius return a list of latlong position and we parse them to create full patient object
  let patients:Patient[]  = generateRandomPointsInRadius(
      torontoCentre[0],torontoCentre[1], 12, qty
    ).map((e)=>{
      return {
        arrivalTime: Date.now(),
        person:{name:e.name, position:e.position},
        severity:randomSeverity()
      }
  });
  return patients;
}

// =================================== Position generation and variation =============================

/**
 * 
 * @param centerLat describe lat of the center of area to observe
 * @param centerLng describe long of the center of area to observe
 * @param radiusKm the radisum from the center of the area to place entities
 * @param numPoints how many entity (people) do you want to place 
 * @param maxAttemptsPerPoint 
 * @returns 
 */
export function generateRandomPointsInRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  numPoints: number,
  maxAttemptsPerPoint = 50
): Entity[] {
  const points: Entity[] = [];
  const R = 6371; // Earth radius km

  const isOnLand = (lat: number, lng: number): boolean => {
    if (lat < 43.59) return false;
    return !waterBoxes.some(([minLat, maxLat, minLng, maxLng]) =>
      lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
    );
  };

  let generated = 0;
  while (generated < numPoints) {
    let attempts = 0, placed = false;
    while (attempts < maxAttemptsPerPoint && !placed) {
      const u = Math.random();
      const d = radiusKm * Math.sqrt(u);
      const θ = Math.random() * 2 * Math.PI;
      const latR = (centerLat * Math.PI) / 180;
      const lngR = (centerLng * Math.PI) / 180;
      const newLatR = Math.asin(
        Math.sin(latR) * Math.cos(d / R) +
        Math.cos(latR) * Math.sin(d / R) * Math.cos(θ)
      );
      const newLngR = lngR + Math.atan2(
        Math.sin(θ) * Math.sin(d / R) * Math.cos(latR),
        Math.cos(d / R) - Math.sin(latR) * Math.sin(newLatR)
      );

      const newLat = (newLatR * 180) / Math.PI;
      const newLng = (newLngR * 180) / Math.PI;
      if (isOnLand(newLat, newLng)) {
        points.push({ name: `Person ${generated + 1}`, position: [newLat, newLng] });
        placed = true; generated++;
      }
      attempts++;
    }
    if (!placed) generated++; // prevent infinite loop
  }
  return points;
}

// ==========================================================================================

/*
* Function to generate a single variation of people's positions
* It introduces small, "realistic" random shifts to the base positions.
* The `shiftMagnitude` controls how much points can move.
*/
const gaussianRandom = (mean = 0, stdev = 1) => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdev + mean;
};
export const generatePeopleVariation = (
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