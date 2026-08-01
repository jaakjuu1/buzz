import { Hash, MessagesSquare } from "lucide-react";

import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { cn } from "@/shared/lib/cn";
import { characterOffset, roomSpan } from "../model/roomLayout";
import type { WorldCharacter, WorldRoom } from "../model/worldTypes";
import { WorldCharacterChip } from "./WorldCharacterChip";

type WorldRoomTileProps = {
  room: WorldRoom;
  characters: readonly WorldCharacter[];
  nowMs: number;
  onOpenChannel: (channelId: string) => void;
  onOpenProfile: (pubkey: string) => void;
};

/**
 * One channel rendered as a room. The whole floor is a click target that
 * opens the real channel view; characters sit above it on their own layer so
 * clicking a person opens their profile instead.
 */
export function WorldRoomTile({
  room,
  characters,
  nowMs,
  onOpenChannel,
  onOpenProfile,
}: WorldRoomTileProps) {
  const span = roomSpan(characters.length);
  const TypeIcon = room.channelType === "forum" ? MessagesSquare : Hash;
  const isActive = room.work !== null;

  return (
    <div
      className={cn(
        "relative min-h-40 rounded-xl border bg-card/60 shadow-xs transition-colors",
        isActive
          ? "border-primary/50 ring-1 ring-primary/30"
          : "border-border/70 hover:border-border",
        span === 2 && "sm:col-span-2",
      )}
      data-testid={`world-room-${room.channelId}`}
    >
      <button
        aria-label={`Open #${room.name}`}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`world-room-door-${room.channelId}`}
        onClick={() => onOpenChannel(room.channelId)}
        type="button"
      />
      <header className="pointer-events-none relative z-10 flex items-center gap-1.5 px-3 pt-2.5">
        <TypeIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="min-w-0 truncate text-sm font-medium">
          {room.name}
        </span>
        {room.hasUnread ? (
          <span
            className="ml-auto shrink-0 rounded-full bg-primary/15 px-1.5 text-2xs font-medium tabular-nums text-primary"
            data-testid={`world-room-unread-${room.channelId}`}
            title={`${room.unreadCount} unread`}
          >
            {Math.min(room.unreadCount, 99)}
          </span>
        ) : null}
      </header>
      {isActive && room.work ? (
        <p className="pointer-events-none relative z-10 px-3 pt-0.5 text-2xs text-primary">
          {room.work.agentCount === 1
            ? "1 agent working"
            : `${room.work.agentCount} agents working`}
          {" · "}
          <span className="tabular-nums">
            {formatElapsed(nowMs - room.work.anchorAt)}
          </span>
        </p>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-9">
        {characters.map((character, index) => (
          <WorldCharacterChip
            character={character}
            key={character.pubkey}
            nowMs={nowMs}
            offset={characterOffset(character.pubkey, index, characters.length)}
            onOpenProfile={onOpenProfile}
          />
        ))}
        {characters.length === 0 ? (
          <p className="absolute inset-x-0 bottom-3 text-center text-2xs text-muted-foreground/60">
            Quiet
          </p>
        ) : null}
      </div>
    </div>
  );
}
