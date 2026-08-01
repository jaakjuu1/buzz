import * as React from "react";

import { useAppShell } from "@/app/AppShellContext";
import { useWorkingChannels } from "@/features/agents/agentWorkingSignal";
import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
import { useChannelsQuery } from "@/features/channels/hooks";
import { useCommunities } from "@/features/communities/useCommunities";
import { useRelayMembersQuery } from "@/features/community-members/hooks";
import { usePresenceQuery } from "@/features/presence/hooks";
import { useUsersBatchQuery } from "@/features/profile/hooks";
import { useIdentityQuery } from "@/shared/api/hooks";
import {
  buildWorldState,
  type WorldAgentInput,
} from "../model/worldProjection";
import type { WorldState } from "../model/worldTypes";

const EMPTY_PROFILES = Object.freeze({});
const EMPTY_PRESENCE = Object.freeze({});

/**
 * Assembles the world projection from the stores the rest of the desktop
 * already maintains — read-only: no new subscriptions, no writes.
 */
export function useWorldState(): {
  worldState: WorldState;
  isLoading: boolean;
} {
  const { activeCommunity } = useCommunities();
  const identityQuery = useIdentityQuery();
  const channelsQuery = useChannelsQuery();
  const workingChannels = useWorkingChannels();
  const relayAgentsQuery = useRelayAgentsQuery();
  const managedAgentsQuery = useManagedAgentsQuery();
  const relayMembersQuery = useRelayMembersQuery();
  const { unreadChannelCounts } = useAppShell();

  const channels = channelsQuery.data;
  const relayAgents = relayAgentsQuery.data;
  const managedAgents = managedAgentsQuery.data;
  const relayMembers = relayMembersQuery.data;

  const memberPubkeys = React.useMemo(
    () => (relayMembers ?? []).map((member) => member.pubkey),
    [relayMembers],
  );

  const agents = React.useMemo<WorldAgentInput[]>(() => {
    const rows: WorldAgentInput[] = [];
    for (const agent of relayAgents ?? []) {
      rows.push({
        pubkey: agent.pubkey,
        name: agent.name,
        homeChannelIds: agent.channelIds,
      });
    }
    for (const agent of managedAgents ?? []) {
      rows.push({
        pubkey: agent.pubkey,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
      });
    }
    return rows;
  }, [managedAgents, relayAgents]);

  const allPubkeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const pubkey of memberPubkeys) set.add(pubkey.toLowerCase());
    for (const agent of agents) set.add(agent.pubkey.toLowerCase());
    for (const working of workingChannels) {
      for (const pubkey of working.agentPubkeys) set.add(pubkey.toLowerCase());
    }
    return [...set].sort();
  }, [agents, memberPubkeys, workingChannels]);

  const profilesQuery = useUsersBatchQuery(allPubkeys);
  const presenceQuery = usePresenceQuery(memberPubkeys);

  const worldState = React.useMemo(
    () =>
      buildWorldState({
        communityName: activeCommunity?.name ?? "Community",
        channels: channels ?? [],
        workingChannels,
        agents,
        memberPubkeys,
        profiles: profilesQuery.data?.profiles ?? EMPTY_PROFILES,
        presence: presenceQuery.data ?? EMPTY_PRESENCE,
        unreadCounts: unreadChannelCounts,
        currentPubkey: identityQuery.data?.pubkey ?? null,
      }),
    [
      activeCommunity?.name,
      agents,
      channels,
      identityQuery.data?.pubkey,
      memberPubkeys,
      presenceQuery.data,
      profilesQuery.data?.profiles,
      unreadChannelCounts,
      workingChannels,
    ],
  );

  return {
    worldState,
    isLoading: channelsQuery.isLoading,
  };
}
