import * as React from "react";

import { msgContextKey } from "@/features/channels/readState/readStateFormat";

type UseShellReadStateHelpersInput = {
  getChannelReadAt: (contextKey: string) => number | null;
  getOwnReadAt: (contextKey: string) => number | null;
  markChannelRead: (
    contextKey: string,
    readAt: string | null | undefined,
    options?: { topLevelOnly?: boolean },
  ) => void;
};

/**
 * Thread- and message-level read-frontier helpers layered on the single
 * AppShell-mounted ReadStateManager. Extracted from AppShell so the shell
 * stays under the file-size ceiling; the semantics are unchanged.
 */
export function useShellReadStateHelpers({
  getChannelReadAt,
  getOwnReadAt,
  markChannelRead,
}: UseShellReadStateHelpersInput) {
  const getThreadReadAt = React.useCallback(
    (rootId: string, channelId?: string | null) => {
      const threadReadAt = getOwnReadAt(`thread:${rootId}`);
      if (!channelId) {
        return threadReadAt;
      }

      const channelReadAt = getChannelReadAt(channelId);
      if (threadReadAt === null) {
        return channelReadAt;
      }
      if (channelReadAt === null) {
        return threadReadAt;
      }
      return Math.max(threadReadAt, channelReadAt);
    },
    [getChannelReadAt, getOwnReadAt],
  );

  const markThreadRead = React.useCallback(
    (rootId: string, timestamp: number) => {
      markChannelRead(
        `thread:${rootId}`,
        new Date(timestamp * 1_000).toISOString(),
      );
    },
    [markChannelRead],
  );

  // Per-message read frontier (LP4 v3): effective(msg:<id>) folds through the
  // channel, so a channel-read clears messages older than the top-level frontier.
  const getMessageReadAt = React.useCallback(
    (messageId: string) => getChannelReadAt(msgContextKey(messageId)),
    [getChannelReadAt],
  );
  const markMessageRead = React.useCallback(
    (messageId: string, timestamp: number) =>
      markChannelRead(
        msgContextKey(messageId),
        new Date(timestamp * 1_000).toISOString(),
      ),
    [markChannelRead],
  );

  return { getThreadReadAt, markThreadRead, getMessageReadAt, markMessageRead };
}
