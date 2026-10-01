import {
    offline,
    type CommunityDetails,
    type CommunityDetailsResponse,
    type CommunityDetailsUpdatesResponse,
    type GroupChatDetails,
    type GroupChatDetailsResponse,
    type GroupChatDetailsUpdatesResponse,
    type Member,
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
 * Loads the details of a group or channel: from the cache if that is as new as
 * `detailsLastUpdated`, which is when the chat's summary says they last changed, else from the
 * cache plus whatever the canister says has changed since, else in full from the canister.
 *
 * A caller which already holds the details passes the time up to which they are known to be up to
 * date as `detailsSyncedUpTo`, and is told only that they still are, unless they have changed. The
 * details can run to tens of thousands of members and an active chat asks after every message, so
 * in that case the cached details are neither read nor written, and nothing is handed back to be
 * copied to the main thread and rebuilt into its stores.
 *
 * What the caller holds is taken to be the cached details only if `detailsSyncedUpTo` is no
 * earlier than their timestamp. It was given them when they were cached, and may since have been
 * told they were still up to date at some later time. Otherwise it holds something else (the
 * response with the cached details never reached it, say) and is given the details in full.
 */
export async function loadGroupDetails(
    cache: GroupDetailsCache,
    cacheKey: string,
    detailsLastUpdated: bigint,
    detailsSyncedUpTo: bigint | undefined,
    initial: () => Promise<GroupChatDetailsResponse>,
    updatesSince: (since: bigint) => Promise<GroupChatDetailsUpdatesResponse>,
): Promise<GroupChatDetailsResponse> {
    // The updates since the cached details were cached, if they have already been fetched
    let fetched: Updated<GroupChatDetailsUpdatesResponse> | undefined;
    const cachedTimestamp = cache.cachedGroupDetailsTimestamp(cacheKey);

    if (
        detailsSyncedUpTo !== undefined &&
        cachedTimestamp !== undefined &&
        detailsSyncedUpTo >= cachedTimestamp
    ) {
        if (detailsSyncedUpTo >= detailsLastUpdated || offline()) {
            return { kind: "success_no_updates", timestamp: detailsSyncedUpTo };
        }
        const updates = await updatesSince(cachedTimestamp);
        if (updates.kind === "failure") {
            return { kind: "success_no_updates", timestamp: detailsSyncedUpTo };
        }
        if (updates.kind === "success_no_updates") {
            return {
                kind: "success_no_updates",
                timestamp: later(detailsSyncedUpTo, updates.timestamp),
            };
        }
        fetched = updates;
    }

    return withCachedDetailsLock(groupDetailsLockKey(cacheKey), async () => {
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
            // Either no updates have been fetched, or another tab has written the cached details
            // since they were last read here, so that those fetched aren't the updates since these
            if (cached.timestamp >= detailsLastUpdated || offline()) {
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
    });
}

/**
 * As for `loadGroupDetails`, but for the details of a community
 */
export async function loadCommunityDetails(
    cache: CommunityDetailsCache,
    communityId: string,
    detailsLastUpdated: bigint,
    detailsSyncedUpTo: bigint | undefined,
    initial: () => Promise<CommunityDetailsResponse>,
    updatesSince: (since: bigint) => Promise<CommunityDetailsUpdatesResponse>,
): Promise<CommunityDetailsResponse> {
    let fetched: Updated<CommunityDetailsUpdatesResponse> | undefined;
    const cachedTimestamp = cache.cachedCommunityDetailsTimestamp(communityId);

    if (
        detailsSyncedUpTo !== undefined &&
        cachedTimestamp !== undefined &&
        detailsSyncedUpTo >= cachedTimestamp
    ) {
        if (detailsSyncedUpTo >= detailsLastUpdated || offline()) {
            return { kind: "success_no_updates", lastUpdated: detailsSyncedUpTo };
        }
        const updates = await updatesSince(cachedTimestamp);
        if (updates.kind === "failure") {
            return { kind: "success_no_updates", lastUpdated: detailsSyncedUpTo };
        }
        if (updates.kind === "success_no_updates") {
            return {
                kind: "success_no_updates",
                lastUpdated: later(detailsSyncedUpTo, updates.lastUpdated),
            };
        }
        fetched = updates;
    }

    return withCachedDetailsLock(communityDetailsLockKey(communityId), async () => {
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
            if (cached.lastUpdated >= detailsLastUpdated || offline()) {
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
    });
}

/**
 * Adds members who have been looked up to the cached details of a group or channel, so that they
 * are still held when the details are next read. `asOf` is the time up to which the details were
 * known to be up to date when the lookup was sent, which the canister checked the replica had
 * reached. If the cached details have been updated since, a member who was looked up may have
 * left, or had their role changed, in an update which has already been applied, so the members are
 * left for the next lookup.
 */
export function addMembersToCachedGroupDetails(
    cache: GroupDetailsCache,
    cacheKey: string,
    members: Member[],
    asOf: bigint,
): Promise<void> {
    return withCachedDetailsLock(groupDetailsLockKey(cacheKey), async () => {
        const cached = await cache.getCachedGroupDetails(cacheKey);
        if (cached !== undefined && cached.timestamp <= asOf) {
            await cache.setCachedGroupDetails(cacheKey, withLookedUpMembers(cached, members));
        }
    });
}

/**
 * As for `addMembersToCachedGroupDetails`, but for the details of a community
 */
export function addMembersToCachedCommunityDetails(
    cache: CommunityDetailsCache,
    communityId: string,
    members: Member[],
    asOf: bigint,
): Promise<void> {
    return withCachedDetailsLock(communityDetailsLockKey(communityId), async () => {
        const cached = await cache.getCachedCommunityDetails(communityId);
        if (cached !== undefined && cached.lastUpdated <= asOf) {
            await cache.setCachedCommunityDetails(
                communityId,
                withLookedUpMembers(cached, members),
            );
        }
    });
}

/**
 * The details with the members who have been looked up added. Those already held are left as they
 * are, since the updates to the details keep them up to date.
 */
export function withLookedUpMembers<D extends { members: Member[] }>(
    details: D,
    members: Member[],
): D {
    const held = new Set(details.members.map((m) => m.userId));
    return {
        ...details,
        members: details.members.concat(members.filter((m) => !held.has(m.userId))),
    };
}

// The cached details of each chat and community are read, changed and written back by one thing at
// a time. Otherwise a load of the details which read them before members who were looked up were
// added would write them back without those members.
const cachedDetailsLocks = new Map<string, Promise<void>>();

function withCachedDetailsLock<T>(key: string, f: () => Promise<T>): Promise<T> {
    const result = (cachedDetailsLocks.get(key) ?? Promise.resolve()).then(f);
    const done = result.then(
        () => undefined,
        () => undefined,
    );
    cachedDetailsLocks.set(key, done);
    void done.then(() => {
        if (cachedDetailsLocks.get(key) === done) {
            cachedDetailsLocks.delete(key);
        }
    });
    return result;
}

function groupDetailsLockKey(cacheKey: string): string {
    return `group_${cacheKey}`;
}

function communityDetailsLockKey(communityId: string): string {
    return `community_${communityId}`;
}

// The canister's timestamp can be behind the one held if the query hit a lagging replica
function later(a: bigint, b: bigint): bigint {
    return a > b ? a : b;
}
