import assert from "node:assert/strict";
import test from "node:test";

import { buildWorldState } from "./worldProjection.ts";

const CHANNELS = [
  {
    id: "ch-eng",
    name: "engineering",
    channelType: "stream",
    archivedAt: null,
  },
  {
    id: "ch-general",
    name: "general",
    channelType: "stream",
    archivedAt: null,
  },
  {
    id: "ch-old",
    name: "attic",
    channelType: "stream",
    archivedAt: "2026-01-01",
  },
  { id: "ch-dm", name: "alice-bob", channelType: "dm", archivedAt: null },
];

const AGENT = "a".repeat(64);
const HUMAN = "b".repeat(64);
const SELF = "c".repeat(64);

function baseInput(overrides = {}) {
  return {
    communityName: "Acme",
    channels: CHANNELS,
    workingChannels: [],
    agents: [],
    memberPubkeys: [],
    profiles: {},
    presence: {},
    unreadCounts: new Map(),
    currentPubkey: null,
    ...overrides,
  };
}

test("archived channels and DMs are not rooms; rooms sort by name", () => {
  const state = buildWorldState(baseInput());
  assert.deepEqual(
    state.rooms.map((room) => room.channelId),
    ["ch-eng", "ch-general"],
  );
  assert.equal(state.hiddenRoomCount, 0);
});

test("room cap hides overflow and reports the hidden count", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: `ch-${i}`,
    name: `channel-${String(i).padStart(2, "0")}`,
    channelType: "stream",
    archivedAt: null,
  }));
  const state = buildWorldState(baseInput({ channels: many, maxRooms: 16 }));
  assert.equal(state.rooms.length, 16);
  assert.equal(state.hiddenRoomCount, 4);
});

test("a working agent stands in the working room with verified placement", () => {
  const state = buildWorldState(
    baseInput({
      workingChannels: [
        {
          channelId: "ch-eng",
          anchorAt: 1000,
          source: "observer",
          agentPubkeys: [AGENT],
        },
      ],
      agents: [
        { pubkey: AGENT, name: "Scout", homeChannelIds: ["ch-general"] },
      ],
    }),
  );
  const occupants = state.charactersByRoom.get("ch-eng") ?? [];
  assert.equal(occupants.length, 1);
  const scout = occupants[0];
  assert.equal(scout.displayName, "Scout");
  assert.equal(scout.state, "working");
  assert.equal(scout.placement, "verified");
  assert.deepEqual(scout.work, { anchorAt: 1000, source: "observer" });
  assert.equal(
    state.rooms.find((r) => r.channelId === "ch-eng")?.work?.agentCount,
    1,
  );
});

test("work in multiple channels picks the most recent anchor", () => {
  const state = buildWorldState(
    baseInput({
      workingChannels: [
        {
          channelId: "ch-eng",
          anchorAt: 1000,
          source: "observer",
          agentPubkeys: [AGENT],
        },
        {
          channelId: "ch-general",
          anchorAt: 2000,
          source: "typing",
          agentPubkeys: [AGENT],
        },
      ],
      agents: [{ pubkey: AGENT, name: "Scout" }],
    }),
  );
  assert.equal((state.charactersByRoom.get("ch-general") ?? []).length, 1);
  assert.equal((state.charactersByRoom.get("ch-eng") ?? []).length, 0);
});

test("an idle agent stands in its home channel with inferred placement", () => {
  const state = buildWorldState(
    baseInput({
      agents: [
        { pubkey: AGENT, name: "Scout", homeChannelIds: ["ch-general"] },
      ],
    }),
  );
  const occupants = state.charactersByRoom.get("ch-general") ?? [];
  assert.equal(occupants.length, 1);
  assert.equal(occupants[0].state, "idle");
  assert.equal(occupants[0].placement, "inferred");
  assert.equal(occupants[0].work, null);
});

test("an idle agent with no visible home waits in the lobby", () => {
  const state = buildWorldState(
    baseInput({
      agents: [{ pubkey: AGENT, name: "Scout", homeChannelIds: ["ch-old"] }],
    }),
  );
  assert.equal(state.lobby.length, 1);
  assert.equal(state.lobby[0].kind, "agent");
  assert.equal(state.lobby[0].placement, "ambient");
});

test("humans stay in the lobby with presence-driven state", () => {
  const state = buildWorldState(
    baseInput({
      memberPubkeys: [HUMAN, SELF],
      presence: { [HUMAN]: "online" },
      currentPubkey: SELF,
      profiles: { [HUMAN]: { displayName: "Anna" } },
    }),
  );
  assert.equal(state.lobby.length, 2);
  // Self sorts first even while offline.
  assert.equal(state.lobby[0].pubkey, SELF);
  assert.ok(state.lobby[0].isSelf);
  const anna = state.lobby[1];
  assert.equal(anna.displayName, "Anna");
  assert.equal(anna.kind, "human");
  assert.equal(anna.state, "online");
  assert.equal(anna.placement, "ambient");
});

test("members flagged isAgent are never placed in the human lobby order as humans", () => {
  const state = buildWorldState(
    baseInput({
      memberPubkeys: [AGENT],
      profiles: { [AGENT]: { isAgent: true, displayName: "Relay bot" } },
    }),
  );
  assert.equal(state.lobby.length, 1);
  assert.equal(state.lobby[0].kind, "agent");
});

test("agent listed as member is not duplicated as a human", () => {
  const state = buildWorldState(
    baseInput({
      memberPubkeys: [AGENT],
      agents: [{ pubkey: AGENT, name: "Scout", homeChannelIds: ["ch-eng"] }],
    }),
  );
  assert.equal(state.lobby.length, 0);
  assert.equal((state.charactersByRoom.get("ch-eng") ?? []).length, 1);
});

test("unread counts land on rooms", () => {
  const state = buildWorldState(
    baseInput({ unreadCounts: new Map([["ch-eng", 3]]) }),
  );
  const room = state.rooms.find((r) => r.channelId === "ch-eng");
  assert.equal(room?.unreadCount, 3);
  assert.equal(room?.hasUnread, true);
  assert.equal(
    state.rooms.find((r) => r.channelId === "ch-general")?.hasUnread,
    false,
  );
});

test("working pubkey without a roster row still renders as an agent", () => {
  const state = buildWorldState(
    baseInput({
      workingChannels: [
        {
          channelId: "ch-eng",
          anchorAt: 500,
          source: "observer",
          agentPubkeys: [AGENT],
        },
      ],
    }),
  );
  const occupants = state.charactersByRoom.get("ch-eng") ?? [];
  assert.equal(occupants.length, 1);
  assert.equal(occupants[0].kind, "agent");
  // Falls back to the canonical truncated-pubkey label.
  assert.match(occupants[0].displayName, /^a{8}…a{4}$/u);
});
