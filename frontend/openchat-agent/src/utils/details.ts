import {
    offline,
    type CommunityDetails,
    type CommunityDetailsResponse,
    type CommunityDetailsUpdatesResponse,
    type GroupChatDetails,
    type GroupChatDetailsResponse,
    type GroupChatDetailsUpdatesResponse,
} from "@shared";
import { mergeCommunityDetails, mergeGroupChatDetails } from "./chat";
import type { ChatsDb } from "./chatsDb";

type GroupDetailsCache = Pick<
    ChatsDb,
    "getCachedGroupDetails" | "setCachedGroupDetails" | "cachedGroupDetailsTimestamp"
>;
type CommunityDetailsCache = Pick<
    ChatsDb,
    "getCachedCommunityDetails" | "setCachedCommunityDetails" | "cachedCommunityDetailsTimestamp"
>;

type Updated<T> = Extract<T, { kind: "success" }>;

/**
 * Loads the details of a group or channel: from the cache if that is as new as the chat's summary,
 * else from the cache plus whatever the canister says has changed since, else in full from the
 * canister.
 *
 * A caller which already holds the details passes the timestamp they were good up to as
 * `heldTimestamp`, and is told only that they still are, unless they have changed. The details can
 * run to tens of thousands of members and an active chat asks after every message, so in that case
 * the cached details are neither read nor written, and nothing is handed back to be copied to the
 * main thread and rebuilt into its stores.
 *
 * What the caller holds is taken to be the cached details only if `heldTimestamp` is no earlier
 * than theirs. It was given them when they were cached, and may since have been told they were
 * still good at some later time. Otherwise it holds something else (the response with the cached
 * details never reached it, say) and is given the details in full.
 */
export async function loadGroupDetails(
    cache: GroupDetailsCache,
    cacheKey: string,
    chatLastUpdated: bigint,
    heldTimestamp: bigint | undefined,
    initial: () => Promise<GroupChatDetailsResponse>,
    updatesSince: (since: bigint) => Promise<GroupChatDetailsUpdatesResponse>,
): Promise<GroupChatDetailsResponse> {
    // The updates since the cached details were cached, if they have already been fetched
    let fetched: Updated<GroupChatDetailsUpdatesResponse> | undefined;
    const cachedTimestamp = cache.cachedGroupDetailsTimestamp(cacheKey);

    if (
        heldTimestamp !== undefined &&
        cachedTimestamp !== undefined &&
        heldTimestamp >= cachedTimestamp
    ) {
        if (heldTimestamp >= chatLastUpdated || offline()) {
            return { kind: "success_no_updates", timestamp: heldTimestamp };
        }
        const updates = await updatesSince(cachedTimestamp);
        if (updates.kind === "failure") {
            return { kind: "success_no_updates", timestamp: heldTimestamp };
        }
        if (updates.kind === "success_no_updates") {
            return {
                kind: "success_no_updates",
                timestamp: later(heldTimestamp, updates.timestamp),
            };
        }
        fetched = updates;
    }

    const cached = await cache.getCachedGroupDetails(cacheKey);
    if (cached === undefined) {
        const details = await initial();
        if ("members" in details) {
            await cache.setCachedGroupDetails(cacheKey, details);
        }
        return details;
    }

    let details: GroupChatDetails;
    if (fetched !== undefined && cached.timestamp === cachedTimestamp) {
        details = mergeGroupChatDetails(cached, fetched);
    } else {
        // Either no updates have been fetched, or another tab has written the cached details since
        // they were last read here, so that those fetched aren't the updates since these
        if (cached.timestamp >= chatLastUpdated || offline()) {
            return cached;
        }
        const updates = await updatesSince(cached.timestamp);
        if (updates.kind === "failure") {
            return cached;
        }
        details =
            updates.kind === "success"
                ? mergeGroupChatDetails(cached, updates)
                : { ...cached, timestamp: updates.timestamp };
    }

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
    let fetched: Updated<CommunityDetailsUpdatesResponse> | undefined;
    const cachedTimestamp = cache.cachedCommunityDetailsTimestamp(communityId);

    if (
        heldTimestamp !== undefined &&
        cachedTimestamp !== undefined &&
        heldTimestamp >= cachedTimestamp
    ) {
        if (heldTimestamp >= communityLastUpdated || offline()) {
            return { kind: "success_no_updates", lastUpdated: heldTimestamp };
        }
        const updates = await updatesSince(cachedTimestamp);
        if (updates.kind === "failure") {
            return { kind: "success_no_updates", lastUpdated: heldTimestamp };
        }
        if (updates.kind === "success_no_updates") {
            return {
                kind: "success_no_updates",
                lastUpdated: later(heldTimestamp, updates.lastUpdated),
            };
        }
        fetched = updates;
    }

    const cached = await cache.getCachedCommunityDetails(communityId);
    if (cached === undefined) {
        const details = await initial();
        if (details.kind === "success") {
            await cache.setCachedCommunityDetails(communityId, details);
        }
        return details;
    }

    let details: CommunityDetails;
    if (fetched !== undefined && cached.lastUpdated === cachedTimestamp) {
        details = mergeCommunityDetails(cached, fetched);
    } else {
        if (cached.lastUpdated >= communityLastUpdated || offline()) {
            return cached;
        }
        const updates = await updatesSince(cached.lastUpdated);
        if (updates.kind === "failure") {
            return cached;
        }
        details =
            updates.kind === "success"
                ? mergeCommunityDetails(cached, updates)
                : { ...cached, lastUpdated: updates.lastUpdated };
    }

    if (details.lastUpdated > cached.lastUpdated) {
        await cache.setCachedCommunityDetails(communityId, details);
    }
    return details;
}

// The canister's timestamp can be behind the one held if the query hit a lagging replica
function later(a: bigint, b: bigint): bigint {
    return a > b ? a : b;
}
