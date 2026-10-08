import {
    HttpError,
    InstructionLimitExceededError,
    ResponseTooLargeError,
    ROLE_MEMBER,
    type CommunityDetails,
    type CommunityDetailsUpdatesResponse,
    type GroupChatDetails,
    type GroupChatDetailsUpdatesResponse,
    type Member,
} from "@shared";
import { afterEach, describe, expect, test, vi } from "vitest";
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

// As the canister fails when there are more updates since the cached details than it can read
// within the instruction limit, as when many of a large chat's members are migrated to new user ids
function tooManyUpdates(): Error {
    return new InstructionLimitExceededError(
        new Error("Canister exceeded the limit of 5000000000 instructions"),
    );
}

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

    // The canister keeps the updates to the details for 31 days, and returns the details in full
    // instead of the updates since a time from which some of them have been pruned
    describe("when the canister returns the details in full instead of the updates", () => {
        const snapshot = (timestamp: bigint, members: string[]) => ({
            kind: "snapshot" as const,
            details: details(timestamp, members),
        });

        test("they replace those cached", async () => {
            // `b` left so long ago that the update saying so was pruned
            const { load, stored, initial } = setup(
                details(10n, ["a", "b"]),
                snapshot(30n, ["a", "c"]),
            );

            const resp = await load(30n);

            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "c"]);
            expect(stored.get(key)?.timestamp).toBe(30n);
            expect(initial).not.toHaveBeenCalled();
        });

        test("they replace those held by the caller", async () => {
            const { load, loadToHold, stored } = setup(
                details(10n, ["a", "b"]),
                snapshot(30n, ["a", "c"]),
            );
            await loadToHold();

            const resp = await load(30n, 20n);

            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "c"]);
        });

        test("later details which another tab has cached in the meantime are kept", async () => {
            const { load, loadToHold, stored } = setup(
                details(10n, ["a"]),
                snapshot(30n, ["a", "c"]),
            );
            await loadToHold();
            stored.set(key, details(40n, ["a", "c", "d"]));

            const resp = await load(40n, 20n);

            expect(memberIds(resp)).toEqual(["a", "c", "d"]);
            expect(stored.get(key)?.timestamp).toBe(40n);
        });

        test("details as new which another tab has cached in the meantime are kept", async () => {
            const { load, loadToHold, stored, cache } = setup(
                details(10n, ["a"]),
                snapshot(30n, ["a", "c"]),
            );
            await loadToHold();
            // The same details in full, to which that tab has since added a member it looked up
            stored.set(key, details(30n, ["a", "c", "x"]));

            const resp = await load(30n, 20n);

            expect(memberIds(resp)).toEqual(["a", "c", "x"]);
            expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
        });
    });
    describe("when the canister can't return the updates because there are too many", () => {
        test("the details are loaded in full and replace those cached", async () => {
            const { load, stored, initial, updatesSince } = setup(details(5n, ["a", "x"]));
            updatesSince.mockRejectedValue(tooManyUpdates());

            const resp = await load(10n);

            expect(updatesSince).toHaveBeenCalledWith(5n);
            expect(initial).toHaveBeenCalledTimes(1);
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "b"]);
            expect(stored.get(key)?.timestamp).toBe(10n);
        });

        test("they replace those held by the caller", async () => {
            const { load, loadToHold, stored, initial, updatesSince } = setup(
                details(5n, ["a", "x"]),
            );
            await loadToHold();
            updatesSince.mockRejectedValue(tooManyUpdates());

            const resp = await load(10n, 5n);

            expect(updatesSince.mock.calls).toEqual([[5n]]);
            expect(initial).toHaveBeenCalledTimes(1);
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "b"]);
        });

        test("as they are if the updates are too large to be returned", async () => {
            const { load, stored, updatesSince } = setup(details(5n, ["a", "x"]));
            updatesSince.mockRejectedValue(
                new ResponseTooLargeError(new Error("too large"), 4_000_000, 3_145_728),
            );

            const resp = await load(10n);

            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(memberIds(stored.get(key))).toEqual(["a", "b"]);
        });

        test("the cached details are kept if the details in full can't be loaded", async () => {
            const { load, stored, initial, updatesSince } = setup(details(5n, ["a", "x"]));
            updatesSince.mockRejectedValue(tooManyUpdates());
            initial.mockResolvedValue({ kind: "failure" } as never);

            const resp = await load(10n);

            expect(memberIds(resp)).toEqual(["a", "x"]);
            expect(stored.get(key)?.timestamp).toBe(5n);
        });

        test("those held by the caller are kept if the details in full can't be loaded", async () => {
            const { load, loadToHold, cache, initial, updatesSince } = setup(
                details(5n, ["a", "x"]),
            );
            await loadToHold();
            updatesSince.mockRejectedValue(tooManyUpdates());
            initial.mockResolvedValue({ kind: "failure" } as never);

            expect(await load(10n, 5n)).toEqual({ kind: "success_no_updates", timestamp: 5n });
            expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
        });

        test("any other failure is thrown, as before", async () => {
            const { load, initial, updatesSince } = setup(details(5n, ["a", "x"]));
            const trapped = new HttpError(500, new Error("trapped"));
            updatesSince.mockRejectedValue(trapped);

            await expect(load(10n)).rejects.toBe(trapped);
            expect(initial).not.toHaveBeenCalled();
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

    describe("when the canister returns the details in full instead of the updates", () => {
        const snapshot = (lastUpdated: bigint, members: string[]) => ({
            kind: "snapshot" as const,
            details: details(lastUpdated, members),
        });

        test("they replace those cached", async () => {
            const { load, stored, initial } = setup(
                details(10n, ["a", "b"]),
                snapshot(30n, ["a", "c"]),
            );

            const resp = await load(30n);

            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(memberIds(stored.get(id))).toEqual(["a", "c"]);
            expect(stored.get(id)?.lastUpdated).toBe(30n);
            expect(initial).not.toHaveBeenCalled();
        });

        test("they replace those held by the caller", async () => {
            const { load, loadToHold, stored } = setup(
                details(10n, ["a", "b"]),
                snapshot(30n, ["a", "c"]),
            );
            await loadToHold();

            const resp = await load(30n, 20n);

            expect(memberIds(resp)).toEqual(["a", "c"]);
            expect(memberIds(stored.get(id))).toEqual(["a", "c"]);
        });

        test("later details which another tab has cached in the meantime are kept", async () => {
            const { load, loadToHold, stored } = setup(
                details(10n, ["a"]),
                snapshot(30n, ["a", "c"]),
            );
            await loadToHold();
            stored.set(id, details(40n, ["a", "c", "d"]));

            const resp = await load(40n, 20n);

            expect(memberIds(resp)).toEqual(["a", "c", "d"]);
            expect(stored.get(id)?.lastUpdated).toBe(40n);
        });
    });
    describe("when the canister can't return the updates because there are too many", () => {
        test("the details are loaded in full and replace those cached", async () => {
            const { load, stored, initial, updatesSince } = setup(details(5n, ["a", "x"]));
            updatesSince.mockRejectedValue(tooManyUpdates());

            const resp = await load(10n);

            expect(updatesSince).toHaveBeenCalledWith(5n);
            expect(initial).toHaveBeenCalledTimes(1);
            expect(memberIds(resp)).toEqual(["a", "b"]);
            expect(memberIds(stored.get(id))).toEqual(["a", "b"]);
            expect(stored.get(id)?.lastUpdated).toBe(10n);
        });

        test("the cached details are kept if the details in full can't be loaded", async () => {
            const { load, stored, initial, updatesSince } = setup(details(5n, ["a", "x"]));
            updatesSince.mockRejectedValue(tooManyUpdates());
            initial.mockResolvedValue({ kind: "failure" } as never);

            const resp = await load(10n);

            expect(memberIds(resp)).toEqual(["a", "x"]);
            expect(stored.get(id)?.lastUpdated).toBe(5n);
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
        const stored = new Map([["chat", groupDetails(10n, ["a"])]]);
        const cache = groupCache(stored);

        await addMembersToCachedGroupDetails(cache, "chat", [member("b")], 10n);

        expect(memberIds(stored.get("chat"))).toEqual(["a", "b"]);
        expect(stored.get("chat")?.moreMembersAfter).toBe("a");
        // The details themselves are no more up to date than they were
        expect(stored.get("chat")?.timestamp).toBe(10n);

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
