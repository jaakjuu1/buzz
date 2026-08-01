import { normalizePubkey, truncatePubkey } from "@/shared/lib/pubkey";
import type {
  WorldCharacter,
  WorldCharacterState,
  WorldPlacement,
  WorldPresenceLookup,
  WorldRoom,
  WorldState,
  WorldWorkSource,
} from "./worldTypes";

// Pure projection: Buzz relay/store snapshots in, one UI-agnostic WorldState
// out. Placement is truth-first — a character only stands in a room when a
// live signal (agent turn, typing) or configuration (agent home channel)
// puts it there; everyone else stays in the lobby. The renderer draws this
// state and never invents movement of its own.

/** Structural inputs so tests don't need full API payloads. */
export type WorldChannelInput = {
  id: string;
  name: string;
  channelType: "stream" | "forum" | "dm";
  archivedAt: string | null;
};

export type WorldWorkingChannelInput = {
  channelId: string;
  anchorAt: number;
  source: WorldWorkSource;
  agentPubkeys: readonly string[];
};

export type WorldAgentInput = {
  pubkey: string;
  name?: string | null;
  avatarUrl?: string | null;
  /** Channels the agent is configured to live in (RelayAgent.channelIds). */
  homeChannelIds?: readonly string[];
};

export type WorldProfileInput = {
  displayName?: string | null;
  avatarUrl?: string | null;
  isAgent?: boolean;
};

export type WorldProjectionInput = {
  communityName: string;
  channels: readonly WorldChannelInput[];
  workingChannels: readonly WorldWorkingChannelInput[];
  agents: readonly WorldAgentInput[];
  memberPubkeys: readonly string[];
  profiles: Readonly<Record<string, WorldProfileInput>>;
  presence: WorldPresenceLookup;
  unreadCounts: ReadonlyMap<string, number>;
  currentPubkey: string | null;
  maxRooms?: number;
};

export const DEFAULT_MAX_ROOMS = 16;

function resolveDisplayName(
  pubkey: string,
  agentName: string | null | undefined,
  profile: WorldProfileInput | undefined,
): string {
  return (
    profile?.displayName?.trim() || agentName?.trim() || truncatePubkey(pubkey)
  );
}

function compareByName(a: { displayName: string }, b: { displayName: string }) {
  return a.displayName.localeCompare(b.displayName, undefined, {
    sensitivity: "base",
  });
}

const LOBBY_STATE_ORDER: Record<WorldCharacterState, number> = {
  working: 0,
  online: 1,
  idle: 2,
  away: 3,
  offline: 4,
};

export function buildWorldState(input: WorldProjectionInput): WorldState {
  const maxRooms = input.maxRooms ?? DEFAULT_MAX_ROOMS;

  const visibleChannels = input.channels
    .filter(
      (channel) => channel.archivedAt === null && channel.channelType !== "dm",
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  const cappedChannels = visibleChannels.slice(0, maxRooms);
  const hiddenRoomCount = visibleChannels.length - cappedChannels.length;
  const roomIds = new Set(cappedChannels.map((channel) => channel.id));

  // Best (most recent) live working channel per agent, restricted to rooms
  // that made the cut so nobody walks into a wall.
  const workByAgent = new Map<
    string,
    { channelId: string; anchorAt: number; source: WorldWorkSource }
  >();
  const workByRoom = new Map<
    string,
    { agentCount: number; anchorAt: number; source: WorldWorkSource }
  >();
  for (const working of input.workingChannels) {
    if (!roomIds.has(working.channelId)) continue;
    workByRoom.set(working.channelId, {
      agentCount: working.agentPubkeys.length,
      anchorAt: working.anchorAt,
      source: working.source,
    });
    for (const rawPubkey of working.agentPubkeys) {
      const pubkey = normalizePubkey(rawPubkey);
      const previous = workByAgent.get(pubkey);
      if (!previous || working.anchorAt > previous.anchorAt) {
        workByAgent.set(pubkey, {
          channelId: working.channelId,
          anchorAt: working.anchorAt,
          source: working.source,
        });
      }
    }
  }

  const currentPubkey = input.currentPubkey
    ? normalizePubkey(input.currentPubkey)
    : null;

  const agentByPubkey = new Map<string, WorldAgentInput>();
  for (const agent of input.agents) {
    const pubkey = normalizePubkey(agent.pubkey);
    const existing = agentByPubkey.get(pubkey);
    // Merge duplicate rows (relay + managed) keeping the richest fields.
    agentByPubkey.set(pubkey, {
      pubkey,
      name: agent.name ?? existing?.name ?? null,
      avatarUrl: agent.avatarUrl ?? existing?.avatarUrl ?? null,
      homeChannelIds:
        agent.homeChannelIds && agent.homeChannelIds.length > 0
          ? agent.homeChannelIds
          : (existing?.homeChannelIds ?? []),
    });
  }
  // A working pubkey we have no roster row for is still an agent — the
  // working signal only ever tracks agents.
  for (const pubkey of workByAgent.keys()) {
    if (!agentByPubkey.has(pubkey)) {
      agentByPubkey.set(pubkey, { pubkey, homeChannelIds: [] });
    }
  }

  const characters: WorldCharacter[] = [];

  for (const agent of agentByPubkey.values()) {
    const pubkey = agent.pubkey;
    const profile = input.profiles[pubkey];
    const work = workByAgent.get(pubkey) ?? null;
    let roomId: string | null = null;
    let placement: WorldPlacement = "ambient";
    let state: WorldCharacterState = "idle";
    if (work) {
      roomId = work.channelId;
      placement = "verified";
      state = "working";
    } else {
      const home = agent.homeChannelIds?.find((id) => roomIds.has(id));
      if (home) {
        roomId = home;
        placement = "inferred";
      }
    }
    characters.push({
      pubkey,
      kind: "agent",
      displayName: resolveDisplayName(pubkey, agent.name, profile),
      avatarUrl: agent.avatarUrl ?? profile?.avatarUrl ?? null,
      roomId,
      state,
      placement,
      isSelf: pubkey === currentPubkey,
      work: work ? { anchorAt: work.anchorAt, source: work.source } : null,
    });
  }

  const seen = new Set(characters.map((character) => character.pubkey));
  for (const rawPubkey of input.memberPubkeys) {
    const pubkey = normalizePubkey(rawPubkey);
    if (seen.has(pubkey)) continue;
    seen.add(pubkey);
    const profile = input.profiles[pubkey];
    if (profile?.isAgent) {
      // Agent known only via its profile flag: keep it out of the human
      // lobby but don't guess a room for it.
      characters.push({
        pubkey,
        kind: "agent",
        displayName: resolveDisplayName(pubkey, null, profile),
        avatarUrl: profile?.avatarUrl ?? null,
        roomId: null,
        state: "idle",
        placement: "ambient",
        isSelf: pubkey === currentPubkey,
        work: null,
      });
      continue;
    }
    characters.push({
      pubkey,
      kind: "human",
      displayName: resolveDisplayName(pubkey, null, profile),
      avatarUrl: profile?.avatarUrl ?? null,
      roomId: null,
      state: input.presence[pubkey] ?? "offline",
      placement: "ambient",
      isSelf: pubkey === currentPubkey,
      work: null,
    });
  }

  const rooms: WorldRoom[] = cappedChannels.map((channel) => ({
    channelId: channel.id,
    name: channel.name,
    channelType: channel.channelType,
    unreadCount: input.unreadCounts.get(channel.id) ?? 0,
    hasUnread: (input.unreadCounts.get(channel.id) ?? 0) > 0,
    work: workByRoom.get(channel.id) ?? null,
  }));

  const charactersByRoom = new Map<string, WorldCharacter[]>();
  const lobby: WorldCharacter[] = [];
  for (const character of characters) {
    if (character.roomId) {
      const bucket = charactersByRoom.get(character.roomId);
      if (bucket) {
        bucket.push(character);
      } else {
        charactersByRoom.set(character.roomId, [character]);
      }
    } else {
      lobby.push(character);
    }
  }
  for (const bucket of charactersByRoom.values()) {
    bucket.sort((a, b) => {
      if (a.state === "working" && b.state !== "working") return -1;
      if (b.state === "working" && a.state !== "working") return 1;
      return compareByName(a, b);
    });
  }
  lobby.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    const order = LOBBY_STATE_ORDER[a.state] - LOBBY_STATE_ORDER[b.state];
    if (order !== 0) return order;
    return compareByName(a, b);
  });

  return {
    communityName: input.communityName,
    rooms,
    charactersByRoom,
    lobby,
    hiddenRoomCount,
  };
}
