import type { IsoPlot } from "./isoMath";

// Waypoint planning for character movement, in world (tile) coordinates.
// Characters leave a room through its front door, walk the streets between
// plots, and enter the target room through its door — they never cut
// through walls. Pure functions so routes are unit-testable.

export type WorldPoint = { x: number; y: number };

/** How far outside a plot its door and the street lanes sit. */
export const STREET_MARGIN = 1.2;

const EPSILON = 0.01;

/** Door: middle of the plot's front-left edge, one step into the street. */
export function plotDoor(plot: IsoPlot): WorldPoint {
  return { x: plot.x + plot.w / 2, y: plot.y + plot.h + STREET_MARGIN };
}

function samePoint(a: WorldPoint, b: WorldPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/**
 * Route from `from` (inside `fromPlot`) to `to` (inside `toPlot`).
 *
 * Cross-plot routes go: out the source door, along the source row's street,
 * up/down the corridor just left of the target plot (the inter-column gap),
 * and in through the target door. Same-plot moves walk a straight line.
 */
export function planPath(
  from: WorldPoint,
  to: WorldPoint,
  fromPlot: IsoPlot | null,
  toPlot: IsoPlot | null,
): WorldPoint[] {
  if (!fromPlot || !toPlot || fromPlot.id === toPlot.id) {
    return [from, to];
  }
  const doorOut = plotDoor(fromPlot);
  const doorIn = plotDoor(toPlot);
  const corridorX = toPlot.x - STREET_MARGIN;
  const waypoints: WorldPoint[] = [
    from,
    doorOut,
    { x: corridorX, y: doorOut.y },
    { x: corridorX, y: doorIn.y },
    doorIn,
    to,
  ];
  return waypoints.filter(
    (point, index) => index === 0 || !samePoint(point, waypoints[index - 1]),
  );
}

/** Total length of a polyline, with a projection applied per point. */
export function pathLength<T extends { sx: number; sy: number }>(
  points: readonly T[],
): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(
      points[i].sx - points[i - 1].sx,
      points[i].sy - points[i - 1].sy,
    );
  }
  return length;
}

/**
 * Point at `distance` along a projected polyline (clamped to the ends).
 * Returns the last point for degenerate zero-length paths.
 */
export function pointAlongPath<T extends { sx: number; sy: number }>(
  points: readonly T[],
  distance: number,
): { sx: number; sy: number } {
  if (points.length === 1) {
    return points[0];
  }
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const segment = Math.hypot(next.sx - prev.sx, next.sy - prev.sy);
    if (segment >= remaining) {
      const t = segment === 0 ? 0 : remaining / segment;
      return {
        sx: prev.sx + (next.sx - prev.sx) * t,
        sy: prev.sy + (next.sy - prev.sy) * t,
      };
    }
    remaining -= segment;
  }
  return points[points.length - 1];
}
