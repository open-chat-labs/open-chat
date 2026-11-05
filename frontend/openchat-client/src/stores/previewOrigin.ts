import { writable } from "../utils/stores";

/** The page a community's preview was opened from: Explore (or `/welcome`, which is Explore), or Landing. */
export type CommunityPreviewFrom = "explore" | "landing";

/**
 * Where cancelling a community's preview goes back to, when the preview was opened from somewhere
 * other than the default scope (Explore, `/welcome`, Landing). It's set before the preview's
 * screen mounts, and `cancelPreview` uses it once. `from` names the page, for the preview bar's
 * Back ("Back to Explore" only for Explore).
 */
export type CommunityPreviewOrigin = {
    communityId: string;
    path: string;
    from: CommunityPreviewFrom;
};

export const communityPreviewOriginStore = writable<CommunityPreviewOrigin | undefined>(undefined);
