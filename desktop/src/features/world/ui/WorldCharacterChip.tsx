import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { getPresenceDotClassName } from "@/features/presence/lib/presence";
import { cn } from "@/shared/lib/cn";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import type { WorldCharacter } from "../model/worldTypes";

type WorldCharacterChipProps = {
  character: WorldCharacter;
  nowMs: number;
  onOpenProfile: (pubkey: string) => void;
  /** Percent offsets inside a room tile; omitted for lobby chips. */
  offset?: { x: number; y: number };
};

function characterTitle(character: WorldCharacter, nowMs: number): string {
  if (character.work) {
    const elapsed = formatElapsed(nowMs - character.work.anchorAt);
    const via =
      character.work.source === "observer" ? "agent turn" : "typing signal";
    return `${character.displayName} — working for ${elapsed} (${via})`;
  }
  if (character.kind === "agent") {
    return character.placement === "inferred"
      ? `${character.displayName} — idle in its home channel`
      : `${character.displayName} — idle`;
  }
  return `${character.displayName} — ${character.state}`;
}

/**
 * One character standing in the world. In a room it is absolutely positioned
 * on the tile floor; in the lobby it renders as an inline chip. Clicking
 * always opens the real profile panel — the chip itself is just a projection.
 */
export function WorldCharacterChip({
  character,
  nowMs,
  onOpenProfile,
  offset,
}: WorldCharacterChipProps) {
  const isWorking = character.state === "working";
  const title = characterTitle(character, nowMs);

  const body = (
    <>
      <span className="relative inline-flex">
        <UserAvatar
          avatarUrl={character.avatarUrl}
          displayName={character.displayName}
          size={offset ? "sm" : "xs"}
          accent={character.kind === "agent"}
        />
        {isWorking ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : null}
        {character.kind === "human" ? (
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
              getPresenceDotClassName(
                character.state === "online" ||
                  character.state === "away" ||
                  character.state === "offline"
                  ? character.state
                  : "offline",
              ),
            )}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-20 truncate text-3xs leading-tight",
          isWorking ? "font-medium text-foreground" : "text-muted-foreground",
          character.state === "offline" && "opacity-60",
        )}
      >
        {character.isSelf
          ? `${character.displayName} (you)`
          : character.displayName}
      </span>
      {isWorking && character.work ? (
        <span className="rounded-full bg-primary/10 px-1.5 text-3xs font-medium tabular-nums text-primary">
          {formatElapsed(nowMs - character.work.anchorAt)}
        </span>
      ) : null}
    </>
  );

  if (offset) {
    return (
      <button
        className="pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`world-character-${character.pubkey}`}
        onClick={() => onOpenProfile(character.pubkey)}
        style={{ left: `${offset.x}%`, top: `${offset.y}%` }}
        title={title}
        type="button"
      >
        {body}
      </button>
    );
  }

  return (
    <button
      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 py-1 pl-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`world-character-${character.pubkey}`}
      onClick={() => onOpenProfile(character.pubkey)}
      title={title}
      type="button"
    >
      {body}
    </button>
  );
}
