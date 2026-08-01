import * as React from "react";

import { TopChromeInsetHeader } from "@/shared/layout/TopChromeInsetHeader";
import { useNow } from "@/shared/lib/useNow";
import { Skeleton } from "@/shared/ui/skeleton";
import { useWorldState } from "../hooks/useWorldState";
import { type IsoPlot, layoutScreenBounds } from "../model/isoMath";
import { characterOffset } from "../model/roomLayout";
import {
  buildWorldLayout,
  LOUNGE_PLOT_ID,
  sortPlotsForPaint,
} from "../model/worldLayout";
import type { WorldCharacter } from "../model/worldTypes";
import { IsoCharacter } from "./iso/IsoCharacter";
import { ACTIVITY_GREEN, UNREAD_AMBER } from "./iso/isoColors";
import { IsoRoomScene } from "./iso/IsoRoomScene";
import { RoomOverlay } from "./iso/RoomOverlay";
import { WorldCanvas } from "./WorldCanvas";

const WorldPixiStage = React.lazy(() => import("./pixi/WorldPixiStage"));

type WorldViewProps = {
  onOpenChannel: (channelId: string) => void;
  onOpenProfile: (pubkey: string) => void;
};

type PlacedCharacter = {
  character: WorldCharacter;
  plot: IsoPlot;
  u: number;
  v: number;
};

/**
 * The isometric world: channels as cutaway rooms on a campus, characters as
 * meeples standing where the projection places them. Draws WorldState only —
 * every wall, glow, and glide traces back to a verified or declared signal
 * (see worldProjection.ts).
 */
export function WorldView({ onOpenChannel, onOpenProfile }: WorldViewProps) {
  const { worldState, isLoading } = useWorldState();
  // Coarse tick: elapsed labels only need ~half-minute resolution.
  const nowMs = useNow(30_000);
  // Sprite-sheet characters render on a PixiJS canvas; if WebGL/WebGPU init
  // fails we fall back to the DOM meeples.
  const [pixiUnavailable, setPixiUnavailable] = React.useState(false);

  const layout = buildWorldLayout(
    worldState.rooms.map((room) => ({
      channelId: room.channelId,
      occupantCount:
        worldState.charactersByRoom.get(room.channelId)?.length ?? 0,
    })),
    worldState.lobby.length,
  );
  const bounds = layoutScreenBounds(layout.all);
  const stageWidth = bounds.maxX - bounds.minX;
  const stageHeight = bounds.maxY - bounds.minY;
  const roomsById = new Map(
    worldState.rooms.map((room) => [room.channelId, room]),
  );

  const placed: PlacedCharacter[] = [];
  for (const plot of layout.all) {
    const occupants =
      plot.kind === "lounge"
        ? worldState.lobby
        : (worldState.charactersByRoom.get(plot.id) ?? []);
    const maxColumns = plot.kind === "lounge" ? 8 : 4;
    let deskSlot = 0;
    occupants.forEach((character, index) => {
      if (character.state === "working" && plot.kind === "room") {
        // Working agents take desk spots along the back wall.
        const slot = deskSlot;
        deskSlot += 1;
        placed.push({
          character,
          plot,
          u: Math.min(0.78, 0.3 + slot * 0.16),
          v: 0.24 + (slot % 2) * 0.1,
        });
        return;
      }
      const offset = characterOffset(
        character.pubkey,
        index,
        occupants.length,
        maxColumns,
      );
      placed.push({ character, plot, u: offset.x / 100, v: offset.y / 100 });
    });
  }
  // Stable element order (and stable DOM nodes) per pubkey: when the
  // projection moves a character to another room, the movement controller
  // walks the same element there along the streets.
  placed.sort((a, b) => a.character.pubkey.localeCompare(b.character.pubkey));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TopChromeInsetHeader data-tauri-drag-region flush>
        <header className="flex min-h-9 min-w-0 cursor-default select-none items-center gap-2 px-5 py-2">
          <span className="min-w-0 truncate text-sm font-semibold">
            {worldState.communityName}
          </span>
          <span className="text-sm text-muted-foreground">· World</span>
          <span className="ml-auto hidden text-2xs text-muted-foreground sm:block">
            Drag to pan · scroll to zoom
          </span>
        </header>
      </TopChromeInsetHeader>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="grid flex-1 grid-cols-2 gap-4 p-6 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((slot) => (
              <Skeleton className="min-h-40 rounded-xl" key={slot} />
            ))}
          </div>
        ) : worldState.rooms.length === 0 && worldState.lobby.length === 0 ? (
          <div className="m-6 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No channels yet — the world grows as channels are created.
            </p>
          </div>
        ) : (
          <>
            <WorldCanvas
              canvasLayer={
                pixiUnavailable
                  ? undefined
                  : (camera) => (
                      <React.Suspense fallback={null}>
                        <WorldPixiStage
                          bounds={bounds}
                          camera={camera}
                          key={`${bounds.minX}:${bounds.minY}:${bounds.maxX}:${bounds.maxY}`}
                          nowMs={nowMs}
                          onOpenProfile={onOpenProfile}
                          onUnavailable={() => setPixiUnavailable(true)}
                          placements={placed}
                        />
                      </React.Suspense>
                    )
              }
              stageHeight={stageHeight}
              stageWidth={stageWidth}
            >
              <svg
                aria-hidden
                className="absolute left-0 top-0"
                height={stageHeight}
                role="presentation"
                viewBox={`${bounds.minX} ${bounds.minY} ${stageWidth} ${stageHeight}`}
                width={stageWidth}
              >
                <defs>
                  <radialGradient id="world-activity-glow">
                    <stop
                      offset="0%"
                      stopColor={ACTIVITY_GREEN}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={ACTIVITY_GREEN}
                      stopOpacity={0}
                    />
                  </radialGradient>
                </defs>
                {sortPlotsForPaint(layout.all).map((plot) => (
                  <IsoRoomScene
                    key={plot.id}
                    plot={plot}
                    working={roomsById.get(plot.id)?.work != null}
                  />
                ))}
              </svg>
              {layout.all.map((plot) => (
                <RoomOverlay
                  bounds={bounds}
                  key={plot.id}
                  nowMs={nowMs}
                  onOpenChannel={
                    plot.id === LOUNGE_PLOT_ID ? null : onOpenChannel
                  }
                  plot={plot}
                  room={roomsById.get(plot.id) ?? null}
                />
              ))}
              {pixiUnavailable
                ? placed.map(({ character, plot, u, v }) => (
                    <IsoCharacter
                      bounds={bounds}
                      character={character}
                      key={character.pubkey}
                      nowMs={nowMs}
                      onOpenProfile={onOpenProfile}
                      plot={plot}
                      u={u}
                      v={v}
                    />
                  ))
                : null}
            </WorldCanvas>
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col gap-1 rounded-lg border border-border/60 bg-background/85 px-2.5 py-2 text-2xs text-muted-foreground shadow-xs backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: ACTIVITY_GREEN }}
                />
                Agent working (live signal)
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: UNREAD_AMBER }}
                />
                Unread messages
              </span>
              {worldState.lobby.length > 0 ? (
                <span className="max-w-52 text-pretty">
                  People wait in the lounge — Buzz doesn't track which channel
                  someone is reading.
                </span>
              ) : null}
              {worldState.hiddenRoomCount > 0 ? (
                <span>
                  +{worldState.hiddenRoomCount} more channels not shown
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
