import type { Entity, LatLngTuple, Severity, Patient } from "../types";

const waterBoxes = [
  [43.60, 43.64, -79.54, -79.40], // Humber Bay
  [43.60, 43.65, -79.40, -79.33], // Inner Harbour
  [43.60, 43.66, -79.33, -79.20], // Outer Harbour
];


function randomName() {
  return `P‑${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
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


export function nearestProviderIdx(pos: LatLngTuple, list: { position: LatLngTuple }[]) {
  let best = 0, min = Number.POSITIVE_INFINITY;
 
  return best;
}