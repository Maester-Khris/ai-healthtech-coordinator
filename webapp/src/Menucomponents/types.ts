export type LatLngTuple  = [number, number];
export interface Entity  { name: string; position: LatLngTuple }
export interface RouteData {
  person: Entity;
  provider: Entity;
  distance: number;   // metres
  travelTime: number; // seconds
}
export interface SimulationParams {
  durationMin: number;      // total simulation length
  totalPeople: number;      // max people to generate
  maxIntervalSec: number;   // upper‑bound between two batches
}