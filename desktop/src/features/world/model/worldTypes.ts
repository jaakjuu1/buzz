import type { ChannelType, PresenceStatus } from "@/shared/api/types";

/**
 * How much evidence backs a character's placement in the world.
 *
 * - "verified": backed by a live signal (active agent turn, typing).
 * - "inferred": derived from configuration (an agent's home channels).
 * - "ambient": no per-channel evidence — the character stands in the lobby.
 *
 * The renderer must never present "ambient" placement as activity.
 */
export type WorldPlacement = "verified" | "inferred" | "ambient";

export type WorldActorKind = "human" | "agent";

export type WorldWorkSource = "observer" | "typing";

export type WorldCharacterState =
  | "working"
  | "online"
  | "away"
  | "offline"
  | "idle";

export type WorldCharacter = {
  pubkey: string;
  kind: WorldActorKind;
  displayName: string;
  avatarUrl: string | null;
  /** Channel id of the room the character stands in; null = lobby. */
  roomId: string | null;
  state: WorldCharacterState;
  placement: WorldPlacement;
  isSelf: boolean;
  /** Present only while a live working signal backs the placement. */
  work: { anchorAt: number; source: WorldWorkSource } | null;
};

export type WorldRoomWork = {
  agentCount: number;
  anchorAt: number;
  source: WorldWorkSource;
};

export type WorldRoom = {
  channelId: string;
  name: string;
  channelType: ChannelType;
  unreadCount: number;
  hasUnread: boolean;
  /** Aggregate live agent work happening in this room, or null when quiet. */
  work: WorldRoomWork | null;
};

export type WorldState = {
  communityName: string;
  rooms: WorldRoom[];
  /** Characters standing in each room, keyed by channel id. */
  charactersByRoom: ReadonlyMap<string, WorldCharacter[]>;
  /** Characters without room-level evidence (mostly humans). */
  lobby: WorldCharacter[];
  /** Rooms dropped by the room cap, so the UI can say "+N more". */
  hiddenRoomCount: number;
};

export type WorldPresenceLookup = Readonly<Record<string, PresenceStatus>>;
