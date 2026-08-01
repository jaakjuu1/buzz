import { Armchair, Hash, MessagesSquare } from "lucide-react";

import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { cn } from "@/shared/lib/cn";
import {
  type IsoPlot,
  plotCorners,
  type ScreenBounds,
  WALL_H,
} from "../../model/isoMath";
import type { WorldRoom } from "../../model/worldTypes";
import { ACTIVITY_GREEN, UNREAD_AMBER } from "./isoColors";

// HTML interaction layer for one plot: a diamond-shaped click target over
// the floor (clip-path hit-testing keeps clicks inside the tile) plus the
// floating nameplate above the back corner. Keeping interactivity in HTML
// gives us real buttons — focus rings, keyboard access — on top of the SVG.

type RoomOverlayProps = {
  plot: IsoPlot;
  room: WorldRoom | null;
  bounds: ScreenBounds;
  nowMs: number;
  onOpenChannel: ((channelId: string) => void) | null;
};

export function RoomOverlay({
  plot,
  room,
  bounds,
  nowMs,
  onOpenChannel,
}: RoomOverlayProps) {
  const { c00, c10, c11, c01 } = plotCorners(plot);
  const left = c01.sx - bounds.minX;
  const top = c00.sy - bounds.minY;
  const width = c10.sx - c01.sx;
  const height = c11.sy - c00.sy;
  const pct = (point: { sx: number; sy: number }) =>
    `${(((point.sx - c01.sx) / width) * 100).toFixed(2)}% ${(((point.sy - c00.sy) / height) * 100).toFixed(2)}%`;
  const clipPath = `polygon(${pct(c00)}, ${pct(c10)}, ${pct(c11)}, ${pct(c01)})`;

  const isLounge = plot.kind === "lounge";
  const TypeIcon = isLounge
    ? Armchair
    : room?.channelType === "forum"
      ? MessagesSquare
      : Hash;
  const label = isLounge ? "Lounge" : (room?.name ?? "");
  // Rooms hang their plate above the back walls; the open-air lounge floats
  // its label over the middle of the rug instead.
  const plateTop = isLounge
    ? top + height * 0.42
    : c00.sy - WALL_H - bounds.minY - 6;

  return (
    <>
      {onOpenChannel && room ? (
        <button
          aria-label={`Open #${room.name}`}
          className="absolute bg-transparent outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/10"
          data-testid={`world-room-door-${room.channelId}`}
          onClick={() => onOpenChannel(room.channelId)}
          style={{ left, top, width, height, clipPath }}
          type="button"
        />
      ) : null}
      <div
        className="pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5"
        style={{ left: left + width / 2, top: plateTop }}
      >
        {isLounge || !onOpenChannel || !room ? (
          <span className="flex items-center gap-1 rounded-md border border-border/60 bg-background/85 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur-sm">
            <TypeIcon className="h-3 w-3" />
            {label}
          </span>
        ) : (
          <button
            className="pointer-events-auto flex items-center gap-1 rounded-md border border-border/60 bg-background/85 px-2 py-0.5 text-xs font-medium shadow-xs outline-none backdrop-blur-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`world-room-plate-${room.channelId}`}
            onClick={() => onOpenChannel(room.channelId)}
            type="button"
          >
            <TypeIcon
              className={cn(
                "h-3 w-3",
                room.work ? "" : "text-muted-foreground",
              )}
              style={room.work ? { color: ACTIVITY_GREEN } : undefined}
            />
            <span className="max-w-32 truncate">{room.name}</span>
            {room.hasUnread ? (
              <span
                className="rounded-full px-1.5 text-2xs font-semibold tabular-nums text-black/80"
                data-testid={`world-room-unread-${room.channelId}`}
                style={{ backgroundColor: UNREAD_AMBER }}
                title={`${room.unreadCount} unread`}
              >
                {Math.min(room.unreadCount, 99)}
              </span>
            ) : null}
          </button>
        )}
        {room?.work ? (
          <span
            className="rounded-full bg-background/85 px-1.5 text-2xs font-medium tabular-nums backdrop-blur-sm"
            style={{ color: ACTIVITY_GREEN }}
          >
            {room.work.agentCount === 1
              ? "1 agent working"
              : `${room.work.agentCount} agents working`}
            {" · "}
            {formatElapsed(nowMs - room.work.anchorAt)}
          </span>
        ) : null}
      </div>
    </>
  );
}
