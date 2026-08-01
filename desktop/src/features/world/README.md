# World view (`/world`)

Spatial projection of the active community: channels render as rooms, agents
and people as characters. Preview feature (`world` in `preview-features.json`).

## Architecture

```
existing hooks/stores (channels, agentWorkingSignal, presence, members,
profiles, unread via AppShellContext)
        │
        ▼
useWorldState()  ──►  buildWorldState()   (pure, unit-tested)
        │
        ▼
buildWorldLayout() + isoMath   (pure campus/projection geometry)
        │
        ▼
WorldCanvas (pan/zoom camera)
  ├── SVG scene: IsoRoomScene (floors, walls, furniture, activity glow)
  └── HTML layer: RoomOverlay (click targets, nameplates)
                  IsoCharacter (living meeples, see below)
```

## Character movement

`useCharacterMovement` drives each sprite from a requestAnimationFrame loop
(styles written straight to the DOM — no per-frame React renders). Routes
come from `model/pathPlan.ts`: characters leave through their room's front
door, walk the streets between plots, and enter the target room's door —
never through walls. Legs swing via CSS keyframes while walking
(`worldCharacters.css`), idle characters sway gently, and working agents
stand at the desk under a bobbing plumbob.

Two motion classes, kept deliberately separate:

- **Signal-driven walks** — the projection moved the character (agent turn
  started/ended, roster changed). These traverse the street network.
- **Ambient wander** — idle characters stroll to a new spot *inside their
  current plot* every ~9–25 s (deterministic per pubkey). Purely cosmetic
  and never crosses a room boundary, so decorative motion can't be mistaken
  for evidence of activity.

All animation respects `prefers-reduced-motion` (positions snap, loops
disabled).

The renderer only draws `WorldState` — it never subscribes to the relay or
invents motion. Placement is truth-first and carries its evidence level:

- **verified** — a live agent turn or typing signal puts the agent in a room
  (`useWorkingChannels`, observer-primary).
- **inferred** — an idle agent stands in its configured home channel
  (`RelayAgent.channelIds`).
- **ambient** — no per-channel evidence; the character waits in the lounge.
  All humans are ambient because Buzz does not track which channel a person
  is reading, and the UI says so instead of pretending.

Interactions route to existing surfaces: a room's floor opens the channel
route, a character opens the standard `UserProfilePanel` (same
search-param pattern as `/pulse`).

No new event kinds, relay endpoints, or module-level singletons — community
switching needs no extra reset because all state lives in React Query and
the stores that already reset in `resetCommunityState()`.
