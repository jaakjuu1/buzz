import type { IsoPlot } from "./isoMath";

// Deterministic campus layout: rooms pack into a roughly square grid of
// plots, the lounge stretches along the front. Pure function of the room
// list, so the map never reshuffles between renders with the same data.

export const LOUNGE_PLOT_ID = "world-lounge";

const SLOT = 10;
const GAP = 2;
const ROOM_W = 7;
const ROOM_H = 6;
const CROWDED_ROOM_W = 8;
const CROWDED_ROOM_H = 7;
/** Rooms with at least this many occupants get the bigger footprint. */
export const CROWDED_AT = 4;
const LOUNGE_H = 5;
const MIN_LOUNGE_W = 12;

export type WorldLayoutRoomInput = {
  channelId: string;
  occupantCount: number;
};

export type WorldLayout = {
  plots: ReadonlyMap<string, IsoPlot>;
  loungePlot: IsoPlot | null;
  all: readonly IsoPlot[];
};

export function buildWorldLayout(
  rooms: readonly WorldLayoutRoomInput[],
  loungeOccupantCount: number,
): WorldLayout {
  const columns = Math.max(2, Math.ceil(Math.sqrt(rooms.length)));
  const plots = new Map<string, IsoPlot>();

  rooms.forEach((room, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const crowded = room.occupantCount >= CROWDED_AT;
    plots.set(room.channelId, {
      id: room.channelId,
      kind: "room",
      x: column * SLOT,
      y: row * SLOT,
      w: crowded ? CROWDED_ROOM_W : ROOM_W,
      h: crowded ? CROWDED_ROOM_H : ROOM_H,
    });
  });

  let loungePlot: IsoPlot | null = null;
  if (loungeOccupantCount > 0) {
    const rows = Math.ceil(rooms.length / columns);
    // Size the lounge to its crowd instead of the full campus width.
    const width = Math.min(
      Math.max(MIN_LOUNGE_W, 8 + loungeOccupantCount * 2),
      Math.max(MIN_LOUNGE_W, columns * SLOT - GAP),
    );
    loungePlot = {
      id: LOUNGE_PLOT_ID,
      kind: "lounge",
      x: 0,
      y: rows * SLOT,
      w: width,
      h: LOUNGE_H,
    };
  }

  const all = [...plots.values(), ...(loungePlot ? [loungePlot] : [])];
  return { plots, loungePlot, all };
}

/**
 * Painter's order for the isometric scene: plots further back (smaller
 * x + y) draw first so front rooms overlap them correctly.
 */
export function sortPlotsForPaint(plots: readonly IsoPlot[]): IsoPlot[] {
  return [...plots].sort((a, b) => a.x + a.y - (b.x + b.y));
}
