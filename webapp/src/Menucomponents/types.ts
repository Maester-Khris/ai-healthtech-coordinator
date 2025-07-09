import { PriorityQueue } from './utils/priorityQueue';

export type LatLngTuple  = [number, number];
export interface Entity  { name: string; position: LatLngTuple }


export interface RouteData {
  person: Entity;
  provider: Entity;
  distance: number|null;   // metres
  travelTime: number; // seconds
}
export interface SimulationParams {
  durationMin: number;      // total simulation length
  totalPeople: number;      // max people to generate
  maxIntervalSec: number;   // upper‑bound between two batches
}


export type Severity = 'critical' | 'severe' | 'moderate' | 'routine';
export interface Person {
  name: string;
  position: LatLngTuple;        // from leaflet
}
export interface Patient {
  severity: Severity;
  person: Person;
  arrivalTime: number;
}
export interface HealthProvider {
  name: string;
  position: LatLngTuple;
  queue: PriorityQueue<Patient>; // internal wait‑list
  busyness: number;              // queue length (derived but handy for UI)
}



export interface RouteMatrixResponse {
  sources_to_targets: {
    time: number | null;
    distance: number | null;
  }[][];
}
export interface GetRouteMatrixParams {
  mode?: string;
  sources: LatLngTuple[];
  targets: LatLngTuple[];
  apiKey?: string;
}