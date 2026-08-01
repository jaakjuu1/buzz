import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { getPresenceDotClassName } from "@/features/presence/lib/presence";
import { cn } from "@/shared/lib/cn";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import type { PresenceStatus } from "@/shared/api/types";
import type { IsoPlot, ScreenBounds } from "../../model/isoMath";
import type { WorldCharacter } from "../../model/worldTypes";
import { meepleColor } from "./isoColors";
import { useCharacterMovement } from "./useCharacterMovement";
import "./worldCharacters.css";

type IsoCharacterProps = {
  character: WorldCharacter;
  /** Plot the projection placed this character in. */
  plot: IsoPlot;
  /** Fractional floor coordinates of the character's assigned spot. */
  u: number;
  v: number;
  bounds: ScreenBounds;
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
 * A living meeple: avatar head, colored torso, legs that swing while the
 * movement controller walks the sprite along street routes between rooms.
 * Idle characters sway gently and wander their own plot now and then —
 * purely decorative motion, always inside the room the projection placed
 * them in. Working agents stand still at the desk with a bobbing plumbob.
 */
export function IsoCharacter({
  character,
  plot,
  u,
  v,
  bounds,
  nowMs,
  onOpenProfile,
}: IsoCharacterProps) {
  const isWorking = character.state === "working";
  const dimmed = character.kind === "human" && character.state === "offline";
  // Offline/away characters stand still; working agents stay at the desk.
  const canWander = !isWorking && !dimmed && character.state !== "away";

  const { rootRef, walking } = useCharacterMovement({
    plot,
    u,
    v,
    bounds,
    pubkey: character.pubkey,
    wander: canWander,
  });

  return (
    <button
      className={cn(
        "world-character group pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full flex-col items-center outline-none",
        "rounded-md focus-visible:ring-2 focus-visible:ring-ring",
        walking && "world-walking",
      )}
      data-testid={`world-character-${character.pubkey}`}
      onClick={() => onOpenProfile(character.pubkey)}
      ref={rootRef}
      style={{ visibility: "hidden" }}
      title={characterTitle(character, nowMs)}
      type="button"
    >
      {isWorking ? (
        <span
          aria-hidden
          className="world-plumbob mb-1 h-2.5 w-2.5 rounded-xs shadow-sm"
          style={{
            transform: "rotate(45deg) scaleY(1.4)",
            background:
              "linear-gradient(135deg, hsl(130 70% 62%), hsl(130 60% 38%))",
          }}
        />
      ) : null}
      <span className="world-sprite flex flex-col items-center">
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
        {/* Torso in a stable per-pubkey color. */}
        <span
          aria-hidden
          className={cn(
            "h-3 w-4 rounded-t-md rounded-b-sm",
            dimmed && "opacity-50",
          )}
          style={{
            background: `linear-gradient(180deg, ${meepleColor(character.pubkey)}, hsl(var(--foreground) / 0.25))`,
          }}
        />
        {/* Legs — swing while walking. */}
        <span aria-hidden className="-mt-px flex gap-0.5">
          <span
            className={cn(
              "world-leg world-leg-l h-1.5 w-1 rounded-b-full",
              dimmed && "opacity-50",
            )}
            style={{ background: "hsl(var(--foreground) / 0.55)" }}
          />
          <span
            className={cn(
              "world-leg world-leg-r h-1.5 w-1 rounded-b-full",
              dimmed && "opacity-50",
            )}
            style={{ background: "hsl(var(--foreground) / 0.55)" }}
          />
        </span>
      </span>
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
