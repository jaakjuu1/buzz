// 2:1 isometric projection. World coordinates are in "tiles"; screen
// coordinates are CSS pixels inside the world stage (pre camera transform).

export const TILE_W = 44;
export const TILE_H = 22;
/** Height of a room's back walls, in screen px. */
export const WALL_H = 34;
/** Depth of the floor slab under the front edges, in screen px. */
export const SLAB_H = 7;

export type ScreenPoint = { sx: number; sy: number };

export function isoToScreen(x: number, y: number): ScreenPoint {
  return {
    sx: (x - y) * (TILE_W / 2),
    sy: (x + y) * (TILE_H / 2),
  };
}

export type IsoPlot = {
  id: string;
  kind: "room" | "lounge";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PlotCorners = {
  /** Back corner (screen-top of the diamond). */
  c00: ScreenPoint;
  /** Right corner. */
  c10: ScreenPoint;
  /** Front corner (screen-bottom). */
  c11: ScreenPoint;
  /** Left corner. */
  c01: ScreenPoint;
};

export function plotCorners(plot: IsoPlot): PlotCorners {
  return {
    c00: isoToScreen(plot.x, plot.y),
    c10: isoToScreen(plot.x + plot.w, plot.y),
    c11: isoToScreen(plot.x + plot.w, plot.y + plot.h),
    c01: isoToScreen(plot.x, plot.y + plot.h),
  };
}

export type ScreenBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Screen-space bounding box of a set of plots, padded for walls above the
 * back corners and slabs/labels below the front corners.
 */
export function layoutScreenBounds(plots: readonly IsoPlot[]): ScreenBounds {
  if (plots.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const plot of plots) {
    const { c00, c10, c11, c01 } = plotCorners(plot);
    minX = Math.min(minX, c01.sx);
    maxX = Math.max(maxX, c10.sx);
    minY = Math.min(minY, c00.sy - WALL_H);
    maxY = Math.max(maxY, c11.sy + SLAB_H);
  }
  // Breathing room for nameplates above walls and character labels.
  const PAD_X = 48;
  const PAD_TOP = 64;
  const PAD_BOTTOM = 48;
  return {
    minX: minX - PAD_X,
    minY: minY - PAD_TOP,
    maxX: maxX + PAD_X,
    maxY: maxY + PAD_BOTTOM,
  };
}

/** Point inside a plot given fractional coordinates u,v ∈ [0, 1]. */
export function pointInPlot(plot: IsoPlot, u: number, v: number): ScreenPoint {
  return isoToScreen(plot.x + u * plot.w, plot.y + v * plot.h);
}
