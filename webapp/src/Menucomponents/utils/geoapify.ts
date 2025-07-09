import type { Entity, RouteMatrixResponse, GetRouteMatrixParams, RouteData } from "../types";

const GEOAPIFY_API_KEY = "38d52e39400d4a988407942232a566a6";

export async function getRouteMatrix({
    mode = "drive",
    sources,
    targets,
    apiKey = GEOAPIFY_API_KEY
}: GetRouteMatrixParams): Promise<RouteMatrixResponse> {
    const body = JSON.stringify({
        mode,
        sources: sources.map((loc) => ({ location: loc })),
        targets: targets.map((loc) => ({ location: loc })),
    });
    const res = await fetch(
        `https://api.geoapify.com/v1/routematrix?apiKey=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        }
    );
    if (!res.ok) {
        // 4xx/5xx ⇒ throw the server’s text to preserve details
        throw new Error(await res.text());
    }
    return res.json();
}

export function mapMatrixToRoutes(
    matrix: RouteMatrixResponse["sources_to_targets"],
    people: Entity[],
    providers: Entity[]
  ): RouteData[] {
    const routes: RouteData[] = [];
  
    matrix.forEach((srcRow, srcIdx) => {
      let best: RouteData | null = null;
  
      srcRow.forEach((tgtCell, tgtIdx) => {
        if (tgtCell.time == null) return; // unreachable
        if (!best || tgtCell.time < best.travelTime) {
          best = {
            person: people[srcIdx],
            provider: providers[tgtIdx],
            travelTime: tgtCell.time,
            distance: tgtCell.distance,
          };
        }
      });
  
      if (best) routes.push(best);
    });
  
    return routes;
  }