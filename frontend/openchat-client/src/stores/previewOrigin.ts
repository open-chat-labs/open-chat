import { writable } from "../utils/stores";

/**
 * Where cancelling a community's preview goes back to, when the preview was opened from somewhere
 * other than the default scope (Explore, `/welcome`). It's set before the preview's screen mounts,
 * and `cancelPreview` uses it once.
 */
export type CommunityPreviewOrigin = { communityId: string; path: string };

export const communityPreviewOriginStore = writable<CommunityPreviewOrigin | undefined>(undefined);
