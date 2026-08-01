import { TopChromeInsetHeader } from "@/shared/layout/TopChromeInsetHeader";
import { useNow } from "@/shared/lib/useNow";
import { Skeleton } from "@/shared/ui/skeleton";
import { useWorldState } from "../hooks/useWorldState";
import type { WorldCharacter } from "../model/worldTypes";
import { WorldCharacterChip } from "./WorldCharacterChip";
import { WorldRoomTile } from "./WorldRoomTile";

const EMPTY_ROOM: readonly WorldCharacter[] = [];

type WorldViewProps = {
  onOpenChannel: (channelId: string) => void;
  onOpenProfile: (pubkey: string) => void;
};

function WorldSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((slot) => (
        <Skeleton className="min-h-40 rounded-xl" key={slot} />
      ))}
    </div>
  );
}

/**
 * Spatial projection of the community: channels as rooms, agents and people
 * as characters. Everything drawn here is derived from live relay state —
 * the view never invents activity (see worldProjection.ts).
 */
export function WorldView({ onOpenChannel, onOpenProfile }: WorldViewProps) {
  const { worldState, isLoading } = useWorldState();
  // Coarse tick: elapsed labels only need ~half-minute resolution.
  const nowMs = useNow(30_000);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TopChromeInsetHeader data-tauri-drag-region flush>
        <header className="flex min-h-9 min-w-0 cursor-default select-none items-center gap-2 px-5 py-2">
          <span className="min-w-0 truncate text-sm font-semibold">
            {worldState.communityName}
          </span>
          <span className="text-sm text-muted-foreground">· World</span>
          <span className="ml-auto hidden text-2xs text-muted-foreground sm:block">
            Live projection — agents stand where they work
          </span>
        </header>
      </TopChromeInsetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {isLoading ? (
          <WorldSkeleton />
        ) : worldState.rooms.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No channels yet — rooms appear here as channels are created.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            data-testid="world-rooms"
          >
            {worldState.rooms.map((room) => (
              <WorldRoomTile
                characters={
                  worldState.charactersByRoom.get(room.channelId) ?? EMPTY_ROOM
                }
                key={room.channelId}
                nowMs={nowMs}
                onOpenChannel={onOpenChannel}
                onOpenProfile={onOpenProfile}
                room={room}
              />
            ))}
          </div>
        )}
        {worldState.hiddenRoomCount > 0 ? (
          <p className="pt-3 text-2xs text-muted-foreground">
            +{worldState.hiddenRoomCount} more channels not shown
          </p>
        ) : null}
        {worldState.lobby.length > 0 ? (
          <section className="mt-6" data-testid="world-lobby">
            <h2 className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lounge
            </h2>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/40 p-3">
              {worldState.lobby.map((character) => (
                <WorldCharacterChip
                  character={character}
                  key={character.pubkey}
                  nowMs={nowMs}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </div>
            <p className="pt-2 text-2xs text-muted-foreground/80">
              People rest in the lounge because Buzz doesn't track which channel
              someone is reading — only visible activity places a character in a
              room.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
