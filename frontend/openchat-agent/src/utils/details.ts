import {
    offline,
    type CommunityDetailsResponse,
    type CommunityDetailsUpdatesResponse,
    type GroupChatDetailsResponse,
    type GroupChatDetailsUpdatesResponse,
} from "@shared";
import { mergeCommunityDetails, mergeGroupChatDetails } from "./chat";
import type { ChatsDb } from "./chatsDb";

type GroupDetailsCache = Pick<ChatsDb, "getCachedGroupDetails" | "setCachedGroupDetails">;
type CommunityDetailsCache = Pick<
    ChatsDb,
    "getCachedCommunityDetails" | "setCachedCommunityDetails"
>;

/**
 * Loads the details of a group or channel: from the cache if that is as new as the chat's summary,
 * else from the cache plus whatever the canister says has changed since, else in full from the
 * canister.
 *
 * A caller which already holds the details passes the timestamp they were good up to as
 * `heldTimestamp`, and is told only that they still are, unless they have changed.
 */
export async function loadGroupDetails(
    cache: GroupDetailsCache,
    cacheKey: string,
    chatLastUpdated: bigint,
    heldTimestamp: bigint | undefined,
    initial: () => Promise<GroupChatDetailsResponse>,
    updatesSince: (since: bigint) => Promise<GroupChatDetailsUpdatesResponse>,
): Promise<GroupChatDetailsResponse> {
    if (heldTimestamp !== undefined) {
        const timestamp = await confirmHeldDetails(heldTimestamp, chatLastUpdated, updatesSince);
        if (timestamp !== undefined) {
            return { kind: "success_no_updates", timestamp };
        }
    }

    const cached = await cache.getCachedGroupDetails(cacheKey);
    if (cached === undefined) {
        const details = await initial();
        if ("members" in details) {
            await cache.setCachedGroupDetails(cacheKey, details);
        }
        return details;
    }

    if (cached.timestamp >= chatLastUpdated || offline()) {
        return cached;
    }

    const updates = await updatesSince(cached.timestamp);
    if (updates.kind === "failure") {
        return cached;
    }

    const details =
        updates.kind === "success"
            ? mergeGroupChatDetails(cached, updates)
            : { ...cached, timestamp: updates.timestamp };
    if (details.timestamp > cached.timestamp) {
        await cache.setCachedGroupDetails(cacheKey, details);
    }
    return details;
}

/**
 * As for `loadGroupDetails`, but for the details of a community
 */
export async function loadCommunityDetails(
    cache: CommunityDetailsCache,
    communityId: string,
    communityLastUpdated: bigint,
    heldTimestamp: bigint | undefined,
    initial: () => Promise<CommunityDetailsResponse>,
    updatesSince: (since: bigint) => Promise<CommunityDetailsUpdatesResponse>,
): Promise<CommunityDetailsResponse> {
    if (heldTimestamp !== undefined) {
        const lastUpdated = await confirmHeldDetails(
            heldTimestamp,
            communityLastUpdated,
            async (since) => {
                const updates = await updatesSince(since);
                return updates.kind === "success_no_updates"
                    ? { kind: "success_no_updates", timestamp: updates.lastUpdated }
                    : updates;
            },
        );
        if (lastUpdated !== undefined) {
            return { kind: "success_no_updates", lastUpdated };
        }
    }

    const cached = await cache.getCachedCommunityDetails(communityId);
    if (cached === undefined) {
        const details = await initial();
        if (details.kind === "success") {
            await cache.setCachedCommunityDetails(communityId, details);
        }
        return details;
    }

    if (cached.lastUpdated >= communityLastUpdated || offline()) {
        return cached;
    }

    const updates = await updatesSince(cached.lastUpdated);
    if (updates.kind === "failure") {
        return cached;
    }

    const details =
        updates.kind === "success"
            ? mergeCommunityDetails(cached, updates)
            : { ...cached, lastUpdated: updates.lastUpdated };
    if (details.lastUpdated > cached.lastUpdated) {
        await cache.setCachedCommunityDetails(communityId, details);
    }
    return details;
}

export type DetailsUpdatesOutcome =
    | { kind: "success" }
    | { kind: "success_no_updates"; timestamp: bigint }
    | { kind: "failure" };

/**
 * For a caller which already holds the details of a chat or community as they were at `held`.
 * Returns the timestamp those details are now known to be good up to, or `undefined` if they have
 * changed and so must be loaded in full.
 *
 * The details can run to tens of thousands of members and an active chat asks after every message,
 * so this neither reads nor writes the cached details, and nothing is handed back to be copied to
 * the main thread and rebuilt into its stores.
 */
export async function confirmHeldDetails(
    held: bigint,
    lastUpdated: bigint,
    updatesSince: (since: bigint) => Promise<DetailsUpdatesOutcome>,
): Promise<bigint | undefined> {
    if (held >= lastUpdated || offline()) {
        return held;
    }

    const outcome = await updatesSince(held);
    switch (outcome.kind) {
        case "success_no_updates":
            // The canister's timestamp can be behind `held` if the query hit a lagging replica
            return outcome.timestamp > held ? outcome.timestamp : held;
        case "failure":
            return held;
        case "success":
            return undefined;
    }
}
