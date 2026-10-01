import {
    ONE_DAY,
    ROLE_MEMBER,
    type CommunityDetails,
    type CommunityDetailsUpdatesResponse,
    type GroupChatDetails,
    type GroupChatDetailsUpdatesResponse,
    type Member,
} from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    addMembersToCachedCommunityDetails,
    addMembersToCachedGroupDetails,
    loadCommunityDetails,
    loadGroupDetails,
    withLookedUpMembers,
} from "./details";

function member(userId: string): Member {
    return { userId, role: ROLE_MEMBER, displayName: undefined, lapsed: false };
}

function memberIds(details: unknown): string[] {
    return (details as { members: Member[] }).members.map((m) => m.userId);
}

const DAY = BigInt(ONE_DAY);

// The details in these tests mostly date from the first moments of 1970, which are taken to be
// recent, so that the updates since them are complete. The clock is set later where that matters.
beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("loadGroupDetails", () => {
    const key = "chat";

    function details(timestamp: bigint, members: string[]): GroupChatDetails {
        return {
            members: members.map(member),
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            pinnedMessages: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            timestamp,
            bots: [],
            webhooks: [],
        };
    }

    function membersAdded(timestamp: bigint, members: string[]): GroupChatDetailsUpdatesResponse {
        return {
            kind: "success",
            membersAddedOrUpdated: members.map(member),
            membersRemoved: new Set(),
            blockedUsersAdded: new Set(),
            blockedUsersRemoved: new Set(),
            pinnedMessagesRemoved: new Set(),
            pinnedMessagesAdded: new Set(),
            timestamp,
            botsAddedOrUpdated: [],
            botsRemoved: new Set(),
        };
    }

    // `stored` is what is in the cache, which another tab can also write to. Like `ChatsDb`, the
    // cache remembers the timestamp of the details as they were when last read or written here.
    function setup(
        cached: GroupChatDetails | undefined,
        updates?: GroupChatDetailsUpdatesResponse,
    ) {
        const stored = new Map<string, GroupChatDetails>();
        if (cached !== undefined) stored.set(key, cached);
        const seen = new Map<string, bigint>();
        const cache = {
            getCachedGroupDetails: vi.fn((k: string) => {
                const d = stored.get(k);
                if (d === undefined) seen.delete(k);
                else seen.set(k, d.timestamp);
                return Promise.resolve(d);
            }),
            setCachedGroupDetails: vi.fn((k: string, d: GroupChatDetails) => {
                stored.set(k, d);
                seen.set(k, d.timestamp);
                return Promise.resolve();
            }),
            cachedGroupDetailsTimestamp: (k: string) => seen.get(k),
        };
        const initial = vi.fn(() => Promise.resolve(details(10n, ["a", "b"])));
        const updatesSince = vi.fn((_since: bigint) =>
            Promise.resolve(updates ?? { kind: "failure" as const }),
        );
        const load = (detailsLastUpdated: bigint, detailsSyncedUpTo?: bigint) =>
            loadGroupDetails(
                cache,
                key,
                detailsLastUpdated,
                detailsSyncedUpTo,
                initial,
                updatesSince,
            );
        // Loads the details so that the caller holds them, as they were cached
        const loadToHold = async () => {
            await load(stored.get(key)?.timestamp ?? 0n);
            cache.getCachedGroupDetails.mockClear();
            cache.setCachedGroupDetails.mockClear();
            initial.mockClear();
            updatesSince.mockClear();
        };
        return { stored, cache, initial, updatesSince, load, loadToHold };
    }

    test("details which aren't cached are loaded in full and cached", async () => {
        const { load, stored, updatesSince } = setup(undefined);

        const resp = await load(10n);

        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(stored.get(key)?.timestamp).toBe(10n);
        // When they were loaded is noted, so that it is known whether updates since are complete
        expect(stored.get(key)?.syncedAt).toBe(1_000n);
        expect(updatesSince).not.toHaveBeenCalled();
    });

    test("a failure to load the details isn't cached", async () => {
        const { load, initial, cache } = setup(undefined);
        initial.mockResolvedValue({ kind: "failure" } as never);

        expect(await load(10n)).toEqual({ kind: "failure" });
        expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
    });

    test("cached details as new as the summary are returned without asking the canister", async () => {
        const { load, initial, updatesSince } = setup(details(10n, ["a"]));

        const resp = await load(10n);

        expect(memberIds(resp)).toEqual(["a"]);
        expect(initial).not.toHaveBeenCalled();
        expect(updatesSince).not.toHaveBeenCalled();
    });

    test("cached details are brought up to date with the updates since they were cached", async () => {
        const { load, stored, initial, updatesSince } = setup(
            { ...details(10n, ["a"]), moreMembersAfter: "a" },
            membersAdded(20n, ["b"]),
        );

        const resp = await load(20n);

        // Where the members not yet held start is unchanged by the updates
        expect(stored.get(key)?.moreMembersAfter).toBe("a");

        expect(updatesSince).toHaveBeenCalledWith(10n);
        expect(initial).not.toHaveBeenCalled();
        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(memberIds(stored.get(key))).toEqual(["a", "b"]);
        expect(stored.get(key)?.timestamp).toBe(20n);
    });

    test("cached details which haven't changed are returned with the later timestamp", async () => {
        const { load, stored } = setup(details(10n, ["a"]), {
            kind: "success_no_updates",
            timestamp: 20n,
        });

        const resp = await load(20n);

        expect(memberIds(resp)).toEqual(["a"]);
        expect((resp as GroupChatDetails).timestamp).toBe(20n);
        expect(stored.get(key)?.timestamp).toBe(20n);
    });

    test("cached details are returned as they are if the canister can't be reached", async () => {
        const { load, cache } = setup(details(10n, ["a"]), { kind: "failure" });

        const resp = await load(20n);

        expect(memberIds(resp)).toEqual(["a"]);
        expect((resp as GroupChatDetails).timestamp).toBe(10n);
        expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
    });

    describe("when the caller holds the cached details", () => {
        test("those which haven't changed are confirmed without touching the cache", async () => {
            const { load, loadToHold, cache, updatesSince } = setup(details(10n, ["a"]), {
                kind: "success_no_updates",
                timestamp: 30n,
            });
            await loadToHold();

            // The caller has since been told they were still good at 20
            expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 30n });
            // The canister is asked for the updates since they were cached, to which any it
            // returns can be applied
            expect(updatesSince.mock.calls).toEqual([[10n]]);
            expect(cache.getCachedGroupDetails).not.toHaveBeenCalled();
            expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
        });

        test("those as new as the summary are confirmed without asking the canister", async () => {
            const { load, loadToHold, cache, updatesSince } = setup(details(10n, ["a"]));
            await loadToHold();

            expect(await load(20n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 20n });
            expect(updatesSince).not.toHaveBeenCalled();
            expect(cache.getCachedGroupDetails).not.toHaveBeenCalled();
        });

        test("they are kept as they are while offline", async () => {
            const { load, loadToHold, updatesSince } = setup(details(10n, ["a"]));
            await loadToHold();
            vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

            expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 20n });
            expect(updatesSince).not.toHaveBeenCalled();
        });

        test("they are kept as they are if the canister can't be reached", async () => {
            const { load, loadToHold, cache } = setup(details(10n, ["a"]), { kind: "failure" });
            await loadToHold();

            expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 20n });
            expect(cache.getCachedGroupDetails).not.toHaveBeenCalled();
        });

        test("a lagging replica's timestamp doesn't move them backwards", async () => {
            const { load, loadToHold } = setup(details(10n, ["a"]), {
                kind: "success_no_updates",
                timestamp: 15n,
            });
            await loadToHold();

            expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 20n });
        });

        test("those which have changed are brought up to date by asking the canister once", async () => {
            const { load, loadToHold, stored, updatesSince } = setup(
                details(10n, ["a"]),
                membersAdded(30n, ["b"]),
            );
            await loadToHold();

            const resp = await load(30n, 20n);

            expect(updatesSince.mock.calls).toEqual([[10n]]);
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "b"]);
            expect(stored.get(key)?.timestamp).toBe(30n);
        });

        test("updates aren't applied to cached details which another tab has since written", async () => {
            const { load, loadToHold, stored, updatesSince } = setup(details(10n, ["a"]));
            await loadToHold();
            stored.set(key, details(25n, ["a", "b"]));
            updatesSince.mockImplementation((since) =>
                Promise.resolve(membersAdded(30n, since < 25n ? ["b", "c"] : ["c"])),
            );

            const resp = await load(30n, 20n);

            // Asked again for the updates since the details now in the cache
            expect(updatesSince.mock.calls).toEqual([[10n], [25n]]);
            expect(memberIds(resp)).toEqual(["a", "b", "c"]);
            expect(stored.get(key)?.timestamp).toBe(30n);
        });
    });

    test("a caller holding details older than those cached is given the details in full", async () => {
        const { load, loadToHold, updatesSince } = setup(details(10n, ["a", "b"]), {
            kind: "success_no_updates",
            timestamp: 20n,
        });
        await loadToHold();

        // The caller never received the details which were cached at 10
        const resp = await load(20n, 5n);

        expect(updatesSince).toHaveBeenCalledWith(10n);
        expect(memberIds(resp)).toEqual(["a", "b"]);
    });

    test("a caller holding details is given them in full if the cached details haven't been read", async () => {
        const { load } = setup(details(10n, ["a", "b"]), {
            kind: "success_no_updates",
            timestamp: 20n,
        });

        const resp = await load(20n, 10n);

        expect(memberIds(resp)).toEqual(["a", "b"]);
    });

    // The canister keeps the updates to the details for 31 days, so the updates since details which
    // were brought up to date longer ago than that may be missing some
    describe("when the cached details were brought up to date over 30 days ago", () => {
        beforeEach(() => {
            vi.spyOn(Date, "now").mockReturnValue(Number(100n * DAY));
        });

        test("those which have changed are reloaded in full", async () => {
            const { load, stored, initial, updatesSince } = setup(
                details(50n * DAY, ["a", "b"]),
                membersAdded(90n * DAY, ["c"]),
            );
            // `b` left 60 days ago, an update which the canister no longer has
            initial.mockResolvedValue(details(90n * DAY, ["a", "c"]));

            const resp = await load(90n * DAY);

            expect(updatesSince).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "c"]);
            expect(stored.get(key)?.syncedAt).toBe(100n * DAY);
        });

        test("those which haven't changed are returned as they are", async () => {
            const { load, initial, updatesSince } = setup(details(50n * DAY, ["a"]));

            const resp = await load(50n * DAY);

            expect(memberIds(resp)).toEqual(["a"]);
            expect(initial).not.toHaveBeenCalled();
            expect(updatesSince).not.toHaveBeenCalled();
        });

        test("they are kept as they are if they can't be reloaded", async () => {
            const { load, stored, initial, cache } = setup(details(50n * DAY, ["a"]));
            initial.mockResolvedValue({ kind: "failure" } as never);

            const resp = await load(90n * DAY);

            expect(memberIds(resp)).toEqual(["a"]);
            expect(stored.get(key)?.timestamp).toBe(50n * DAY);
            expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
        });

        test("those held by the caller are reloaded in full rather than updated", async () => {
            const { load, loadToHold, initial, updatesSince } = setup(
                details(50n * DAY, ["a", "b"]),
                membersAdded(90n * DAY, ["c"]),
            );
            await loadToHold();
            initial.mockResolvedValue(details(90n * DAY, ["a", "c"]));

            const resp = await load(90n * DAY, 50n * DAY);

            expect(updatesSince).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "c"]);
        });

        test("those brought up to date within 30 days are updated, however long ago they last changed", async () => {
            // Nothing changed between 50 days ago and when they were last brought up to date
            const { load, stored, initial, updatesSince } = setup(
                { ...details(50n * DAY, ["a"]), syncedAt: 80n * DAY },
                membersAdded(90n * DAY, ["b"]),
            );

            const resp = await load(90n * DAY);

            expect(updatesSince).toHaveBeenCalledWith(50n * DAY);
            expect(initial).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(stored.get(key)?.syncedAt).toBe(100n * DAY);
        });

        test("those held by the caller are read from the cache to see whether they can be updated", async () => {
            const { load, loadToHold, cache, initial, updatesSince } = setup(
                { ...details(50n * DAY, ["a"]), syncedAt: 80n * DAY },
                membersAdded(90n * DAY, ["b"]),
            );
            await loadToHold();

            const resp = await load(90n * DAY, 50n * DAY);

            // Their timestamp is too old to tell, but they were brought up to date recently
            expect(cache.getCachedGroupDetails).toHaveBeenCalledTimes(1);
            expect(updatesSince.mock.calls).toEqual([[50n * DAY]]);
            expect(initial).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "b"]);
        });

        test("a copy which doesn't say when it was brought up to date is reloaded in full", async () => {
            const { load, initial, updatesSince } = setup(
                details(95n * DAY, ["a"]),
                membersAdded(99n * DAY, ["b"]),
            );
            initial.mockResolvedValue(details(99n * DAY, ["a", "b"]));

            await load(99n * DAY);

            expect(initial).toHaveBeenCalled();
            expect(updatesSince).not.toHaveBeenCalled();
        });

        test("being told by the canister that they haven't changed brings them up to date", async () => {
            const { load, stored } = setup(
                { ...details(95n * DAY, ["a"]), syncedAt: 90n * DAY },
                { kind: "success_no_updates", timestamp: 96n * DAY },
            );

            await load(96n * DAY);

            expect(stored.get(key)?.timestamp).toBe(96n * DAY);
            expect(stored.get(key)?.syncedAt).toBe(100n * DAY);
        });
    });
});

describe("loadCommunityDetails", () => {
    const id = "community";

    function details(lastUpdated: bigint, members: string[]): CommunityDetails {
        return {
            kind: "success",
            members: members.map(member),
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            lastUpdated,
            userGroups: new Map(),
            referrals: new Set(),
            bots: [],
        };
    }

    function membersAdded(lastUpdated: bigint, members: string[]): CommunityDetailsUpdatesResponse {
        return {
            kind: "success",
            membersAddedOrUpdated: members.map(member),
            membersRemoved: new Set(),
            blockedUsersAdded: new Set(),
            blockedUsersRemoved: new Set(),
            lastUpdated,
            userGroups: [],
            userGroupsDeleted: new Set(),
            referralsAdded: new Set(),
            referralsRemoved: new Set(),
            botsAddedOrUpdated: [],
            botsRemoved: new Set(),
        };
    }

    function setup(
        cached: CommunityDetails | undefined,
        updates?: CommunityDetailsUpdatesResponse,
    ) {
        const stored = new Map<string, CommunityDetails>();
        if (cached !== undefined) stored.set(id, cached);
        const seen = new Map<string, bigint>();
        const cache = {
            getCachedCommunityDetails: vi.fn((k: string) => {
                const d = stored.get(k);
                if (d === undefined) seen.delete(k);
                else seen.set(k, d.lastUpdated);
                return Promise.resolve(d);
            }),
            setCachedCommunityDetails: vi.fn((k: string, d: CommunityDetails) => {
                stored.set(k, d);
                seen.set(k, d.lastUpdated);
                return Promise.resolve();
            }),
            cachedCommunityDetailsTimestamp: (k: string) => seen.get(k),
        };
        const initial = vi.fn(() => Promise.resolve(details(10n, ["a", "b"])));
        const updatesSince = vi.fn((_since: bigint) =>
            Promise.resolve(updates ?? { kind: "failure" as const }),
        );
        const load = (detailsLastUpdated: bigint, detailsSyncedUpTo?: bigint) =>
            loadCommunityDetails(
                cache,
                id,
                detailsLastUpdated,
                detailsSyncedUpTo,
                initial,
                updatesSince,
            );
        const loadToHold = async () => {
            await load(stored.get(id)?.lastUpdated ?? 0n);
            cache.getCachedCommunityDetails.mockClear();
            cache.setCachedCommunityDetails.mockClear();
            initial.mockClear();
            updatesSince.mockClear();
        };
        return { stored, cache, initial, updatesSince, load, loadToHold };
    }

    test("details which aren't cached are loaded in full and cached", async () => {
        const { load, stored, updatesSince } = setup(undefined);

        const resp = await load(10n);

        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(stored.get(id)?.lastUpdated).toBe(10n);
        expect(updatesSince).not.toHaveBeenCalled();
    });

    test("cached details are brought up to date with the updates since they were cached", async () => {
        const { load, stored, updatesSince } = setup(details(10n, ["a"]), membersAdded(20n, ["b"]));

        const resp = await load(20n);

        expect(updatesSince).toHaveBeenCalledWith(10n);
        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(stored.get(id)?.lastUpdated).toBe(20n);
    });

    test("cached details which haven't changed are returned with the later timestamp", async () => {
        const { load, stored } = setup(details(10n, ["a"]), {
            kind: "success_no_updates",
            lastUpdated: 20n,
        });

        const resp = await load(20n);

        expect(memberIds(resp)).toEqual(["a"]);
        expect((resp as CommunityDetails).lastUpdated).toBe(20n);
        expect(stored.get(id)?.lastUpdated).toBe(20n);
    });

    describe("when the caller holds the cached details", () => {
        test("those which haven't changed are confirmed without touching the cache", async () => {
            const { load, loadToHold, cache, updatesSince } = setup(details(10n, ["a"]), {
                kind: "success_no_updates",
                lastUpdated: 30n,
            });
            await loadToHold();

            expect(await load(30n, 20n)).toEqual({
                kind: "success_no_updates",
                lastUpdated: 30n,
            });
            expect(updatesSince.mock.calls).toEqual([[10n]]);
            expect(cache.getCachedCommunityDetails).not.toHaveBeenCalled();
            expect(cache.setCachedCommunityDetails).not.toHaveBeenCalled();
        });

        test("those which have changed are brought up to date by asking the canister once", async () => {
            const { load, loadToHold, stored, updatesSince } = setup(
                details(10n, ["a"]),
                membersAdded(30n, ["b"]),
            );
            await loadToHold();

            const resp = await load(30n, 20n);

            expect(updatesSince.mock.calls).toEqual([[10n]]);
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(stored.get(id)?.lastUpdated).toBe(30n);
        });

        test("updates aren't applied to cached details which another tab has since written", async () => {
            const { load, loadToHold, stored, updatesSince } = setup(details(10n, ["a"]));
            await loadToHold();
            stored.set(id, details(25n, ["a", "b"]));
            updatesSince.mockImplementation((since) =>
                Promise.resolve(membersAdded(30n, since < 25n ? ["b", "c"] : ["c"])),
            );

            const resp = await load(30n, 20n);

            expect(updatesSince.mock.calls).toEqual([[10n], [25n]]);
            expect(memberIds(resp)).toEqual(["a", "b", "c"]);
            expect(stored.get(id)?.lastUpdated).toBe(30n);
        });
    });

    test("a caller holding details older than those cached is given the details in full", async () => {
        const { load, loadToHold } = setup(details(10n, ["a", "b"]), {
            kind: "success_no_updates",
            lastUpdated: 20n,
        });
        await loadToHold();

        const resp = await load(20n, 5n);

        expect(memberIds(resp)).toEqual(["a", "b"]);
    });

    describe("when the cached details were brought up to date over 30 days ago", () => {
        beforeEach(() => {
            vi.spyOn(Date, "now").mockReturnValue(Number(100n * DAY));
        });

        test("those which have changed are reloaded in full", async () => {
            const { load, stored, initial, updatesSince } = setup(
                details(50n * DAY, ["a", "b"]),
                membersAdded(90n * DAY, ["c"]),
            );
            initial.mockResolvedValue(details(90n * DAY, ["a", "c"]));

            const resp = await load(90n * DAY);

            expect(updatesSince).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(stored.get(id)?.syncedAt).toBe(100n * DAY);
        });

        test("those held by the caller are reloaded in full rather than updated", async () => {
            const { load, loadToHold, initial, updatesSince } = setup(
                details(50n * DAY, ["a", "b"]),
                membersAdded(90n * DAY, ["c"]),
            );
            await loadToHold();
            initial.mockResolvedValue(details(90n * DAY, ["a", "c"]));

            const resp = await load(90n * DAY, 50n * DAY);

            expect(updatesSince).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "c"]);
        });

        test("those brought up to date within 30 days are updated, however long ago they last changed", async () => {
            const { load, stored, initial, updatesSince } = setup(
                { ...details(50n * DAY, ["a"]), syncedAt: 80n * DAY },
                membersAdded(90n * DAY, ["b"]),
            );

            const resp = await load(90n * DAY);

            expect(updatesSince).toHaveBeenCalledWith(50n * DAY);
            expect(initial).not.toHaveBeenCalled();
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(stored.get(id)?.syncedAt).toBe(100n * DAY);
        });

        test("those which haven't changed are returned as they are", async () => {
            const { load, initial, updatesSince } = setup(details(50n * DAY, ["a"]));

            const resp = await load(50n * DAY);

            expect(memberIds(resp)).toEqual(["a"]);
            expect(initial).not.toHaveBeenCalled();
            expect(updatesSince).not.toHaveBeenCalled();
        });

        test("they are kept as they are if they can't be reloaded", async () => {
            const { load, stored, initial, cache } = setup(details(50n * DAY, ["a"]));
            initial.mockResolvedValue({ kind: "failure" } as never);

            const resp = await load(90n * DAY);

            expect(memberIds(resp)).toEqual(["a"]);
            expect(stored.get(id)?.lastUpdated).toBe(50n * DAY);
            expect(cache.setCachedCommunityDetails).not.toHaveBeenCalled();
        });
    });
});

describe("withLookedUpMembers", () => {
    test("members are added to those held, leaving any held already as they are", () => {
        const held = { members: [member("a"), member("b")], other: "unchanged" };

        const result = withLookedUpMembers(held, [
            { ...member("b"), displayName: "B" },
            member("c"),
        ]);

        expect(result.members).toEqual([member("a"), member("b"), member("c")]);
        expect(result.other).toBe("unchanged");
    });
});

describe("adding members who have been looked up to the cached details", () => {
    function groupDetails(timestamp: bigint, members: string[]): GroupChatDetails {
        return {
            members: members.map(member),
            moreMembersAfter: "a",
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            pinnedMessages: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            timestamp,
            bots: [],
            webhooks: [],
        };
    }

    function communityDetails(lastUpdated: bigint, members: string[]): CommunityDetails {
        return {
            kind: "success",
            members: members.map(member),
            moreMembersAfter: "a",
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            lastUpdated,
            userGroups: new Map(),
            referrals: new Set(),
            bots: [],
        };
    }

    // Reading and writing the cache each take a tick, as they do in IndexedDB
    const tick = () => new Promise((r) => setTimeout(r, 0));

    function groupCache(stored: Map<string, GroupChatDetails>) {
        return {
            getCachedGroupDetails: async (k: string) => {
                await tick();
                return stored.get(k);
            },
            setCachedGroupDetails: async (k: string, d: GroupChatDetails) => {
                await tick();
                stored.set(k, d);
            },
            cachedGroupDetailsTimestamp: () => undefined,
        };
    }

    function communityCache(stored: Map<string, CommunityDetails>) {
        return {
            getCachedCommunityDetails: async (k: string) => {
                await tick();
                return stored.get(k);
            },
            setCachedCommunityDetails: async (k: string, d: CommunityDetails) => {
                await tick();
                stored.set(k, d);
            },
            cachedCommunityDetailsTimestamp: () => undefined,
        };
    }

    function membersAdded(timestamp: bigint, members: string[]): GroupChatDetailsUpdatesResponse {
        return {
            kind: "success",
            membersAddedOrUpdated: members.map(member),
            membersRemoved: new Set(),
            blockedUsersAdded: new Set(),
            blockedUsersRemoved: new Set(),
            pinnedMessagesRemoved: new Set(),
            pinnedMessagesAdded: new Set(),
            timestamp,
            botsAddedOrUpdated: [],
            botsRemoved: new Set(),
        };
    }

    test("members are added to the cached details of a group", async () => {
        const stored = new Map([["chat", { ...groupDetails(10n, ["a"]), syncedAt: 5n }]]);
        const cache = groupCache(stored);

        await addMembersToCachedGroupDetails(cache, "chat", [member("b")], 10n);

        expect(memberIds(stored.get("chat"))).toEqual(["a", "b"]);
        expect(stored.get("chat")?.moreMembersAfter).toBe("a");
        // The details themselves are no more up to date than they were
        expect(stored.get("chat")?.timestamp).toBe(10n);
        expect(stored.get("chat")?.syncedAt).toBe(5n);

        // Nothing is cached for a chat whose details aren't
        await addMembersToCachedGroupDetails(cache, "other", [member("b")], 10n);
        expect(stored.has("other")).toBe(false);
    });

    test("members are added to the cached details of a community", async () => {
        const stored = new Map([["community", communityDetails(10n, ["a"])]]);

        await addMembersToCachedCommunityDetails(
            communityCache(stored),
            "community",
            [{ ...member("b"), displayName: "B" }],
            10n,
        );

        expect(memberIds(stored.get("community"))).toEqual(["a", "b"]);
        expect(stored.get("community")?.moreMembersAfter).toBe("a");
        expect(stored.get("community")?.lastUpdated).toBe(10n);
    });

    // A member who was looked up may have left, or had their role changed, since the replica which
    // answered had caught up with the details held when the lookup was sent
    test("members aren't added to details which have been updated since the lookup", async () => {
        const group = new Map([["chat", groupDetails(20n, ["a"])]]);
        await addMembersToCachedGroupDetails(groupCache(group), "chat", [member("b")], 10n);
        expect(memberIds(group.get("chat"))).toEqual(["a"]);

        const community = new Map([["community", communityDetails(20n, ["a"])]]);
        await addMembersToCachedCommunityDetails(
            communityCache(community),
            "community",
            [member("b")],
            10n,
        );
        expect(memberIds(community.get("community"))).toEqual(["a"]);
    });

    test("members looked up while the details are being loaded aren't lost", async () => {
        const stored = new Map([["chat", groupDetails(10n, ["a"])]]);
        const cache = groupCache(stored);
        const updatesSince = async () => {
            await tick();
            await tick();
            return membersAdded(20n, ["c"]);
        };

        // The load reads the details while the members are being added, and writes them back
        // once it has the updates
        await Promise.all([
            addMembersToCachedGroupDetails(cache, "chat", [member("x")], 10n),
            loadGroupDetails(
                cache,
                "chat",
                20n,
                undefined,
                () => new Promise(() => {}),
                updatesSince,
            ),
        ]);

        expect(memberIds(stored.get("chat"))).toEqual(["a", "x", "c"]);
        expect(stored.get("chat")?.timestamp).toBe(20n);
    });

    test("members looked up before a load which updates the details aren't added", async () => {
        const stored = new Map([["chat", groupDetails(10n, ["a"])]]);
        const cache = groupCache(stored);

        await Promise.all([
            loadGroupDetails(
                cache,
                "chat",
                20n,
                undefined,
                () => new Promise(() => {}),
                () => Promise.resolve(membersAdded(20n, ["c"])),
            ),
            addMembersToCachedGroupDetails(cache, "chat", [member("x")], 10n),
        ]);

        expect(memberIds(stored.get("chat"))).toEqual(["a", "c"]);
    });
});
