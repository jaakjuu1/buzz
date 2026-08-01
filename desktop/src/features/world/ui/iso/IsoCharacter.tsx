import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { getPresenceDotClassName } from "@/features/presence/lib/presence";
import { cn } from "@/shared/lib/cn";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import type { PresenceStatus } from "@/shared/api/types";
import type { WorldCharacter } from "../../model/worldTypes";
import { meepleColor } from "./isoColors";

type IsoCharacterProps = {
  character: WorldCharacter;
  /** Feet position in stage coordinates. */
  x: number;
  y: number;
  nowMs: number;
  onOpenProfile: (pubkey: string) => void;
};

function presenceFor(character: WorldCharacter): PresenceStatus {
  return character.state === "online" || character.state === "away"
    ? character.state
    : "offline";
}

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
 * A Sims-style meeple standing in the world: avatar head on a colored body,
 * soft floor shadow, and a bobbing green plumbob while working. The wrapper
 * transitions `left`/`top`, so when the projection moves a character to
 * another room the sprite glides there instead of teleporting.
 */
export function IsoCharacter({
  character,
  x,
  y,
  nowMs,
  onOpenProfile,
}: IsoCharacterProps) {
  const isWorking = character.state === "working";
  const dimmed = character.kind === "human" && character.state === "offline";

  return (
    <button
      className={cn(
        "group pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full flex-col items-center outline-none transition-[left,top] duration-700 ease-in-out",
        "rounded-md focus-visible:ring-2 focus-visible:ring-ring",
      )}
      data-testid={`world-character-${character.pubkey}`}
      onClick={() => onOpenProfile(character.pubkey)}
      style={{ left: x, top: y, zIndex: 10 + Math.max(0, Math.round(y)) }}
      title={characterTitle(character, nowMs)}
      type="button"
    >
      {isWorking ? (
        <span
          aria-hidden
          className="mb-0.5 h-2.5 w-2.5 animate-bounce rounded-xs shadow-sm"
          style={{
            transform: "rotate(45deg) scaleY(1.4)",
            background:
              "linear-gradient(135deg, hsl(130 70% 62%), hsl(130 60% 38%))",
          }}
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 -mb-1 inline-flex rounded-full shadow-sm",
          dimmed && "opacity-60 grayscale",
        )}
      >
        <UserAvatar
          accent={character.kind === "agent"}
          avatarUrl={character.avatarUrl}
          displayName={character.displayName}
          size="sm"
        />
        {character.kind === "human" ? (
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
              getPresenceDotClassName(presenceFor(character)),
            )}
          />
        ) : null}
      </span>
      {/* Body: a little rounded torso in a stable per-pubkey color. */}
      <span
        aria-hidden
        className={cn(
          "h-3.5 w-4 rounded-t-md rounded-b-full",
          dimmed && "opacity-50",
        )}
        style={{
          background: `linear-gradient(180deg, ${meepleColor(character.pubkey)}, hsl(var(--foreground) / 0.25))`,
        }}
      />
      {/* Floor shadow. */}
      <span
        aria-hidden
        className="-mt-1 h-1.5 w-6 rounded-full bg-black/25 blur-[1.5px]"
      />
      <span
        className={cn(
          "mt-0.5 max-w-24 truncate rounded-full border border-border/50 bg-background/85 px-1.5 text-3xs leading-tight backdrop-blur-sm",
          isWorking ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {character.isSelf
          ? `${character.displayName} (you)`
          : character.displayName}
      </span>
      {isWorking && character.work ? (
        <span
          className="mt-0.5 rounded-full bg-background/85 px-1.5 text-3xs font-medium tabular-nums backdrop-blur-sm"
          style={{ color: "hsl(130 55% 38%)" }}
        >
          {formatElapsed(nowMs - character.work.anchorAt)}
        </span>
      ) : null}
    </button>
  );
}
