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
WorldView / WorldRoomTile / WorldCharacterChip   (dumb renderers)
```

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
