import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  parseProfilePanelTab,
  parseProfilePanelView,
  type ProfilePanelTab,
  type ProfilePanelView,
} from "@/features/profile/ui/UserProfilePanelUtils";
import { usePreviewFeatureWarning } from "@/shared/features";
import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const WorldScreen = React.lazy(async () => {
  const module = await import("@/features/world/ui/WorldScreen");
  return { default: module.WorldScreen };
});

type WorldRouteSearch = {
  profile?: string;
  profileTab?: ProfilePanelTab;
  profileView?: ProfilePanelView;
};

function validateWorldSearch(
  search: Record<string, unknown>,
): WorldRouteSearch {
  return {
    profile:
      typeof search.profile === "string" && search.profile.length > 0
        ? search.profile
        : undefined,
    profileTab: parseProfilePanelTab(search.profileTab) ?? undefined,
    profileView: parseProfilePanelView(search.profileView) ?? undefined,
  };
}

export const Route = createFileRoute("/world")({
  validateSearch: validateWorldSearch,
  component: WorldRouteComponent,
});

function WorldRouteComponent() {
  usePreviewFeatureWarning("world");
  return (
    <React.Suspense
      fallback={<ViewLoadingFallback includeHeader kind="world" />}
    >
      <WorldScreen />
    </React.Suspense>
  );
}
