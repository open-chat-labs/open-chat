import {
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
    withMembers,
} from "./details";

function member(userId: string): Member {
    return { userId, role: ROLE_MEMBER, displayName: undefined, lapsed: false };
}

function memberIds(details: unknown): string[] {
    return (details as { members: Member[] }).members.map((m) => m.userId);
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
});

describe("withMembers", () => {
    const held = (moreMembersAfter?: string) => ({
        members: [member("a"), member("b")],
        moreMembersAfter,
        other: "unchanged",
    });

    test("members are added to those held, replacing any held already", () => {
        const b = { ...member("b"), displayName: "B" };

        const result = withMembers(held("b"), [b, member("c")]);

        expect(result.members).toEqual([member("a"), b, member("c")]);
        expect(result.moreMembersAfter).toBe("b");
        expect(result.other).toBe("unchanged");
    });

    test("a page which carries on from the members held moves on where the rest start", () => {
        const result = withMembers(held("b"), [member("c")], {
            after: "b",
            moreMembersAfter: "c",
        });

        expect(memberIds(result)).toEqual(["a", "b", "c"]);
        expect(result.moreMembersAfter).toBe("c");
    });

    test("the last page leaves every member held", () => {
        const result = withMembers(held("b"), [member("c")], {
            after: "b",
            moreMembersAfter: undefined,
        });

        expect(result.moreMembersAfter).toBeUndefined();
    });

    test("a page which arrives twice, or out of order, doesn't move where the rest start", () => {
        const result = withMembers(held("c"), [member("c")], {
            after: "b",
            moreMembersAfter: "c",
        });
        expect(result.moreMembersAfter).toBe("c");

        const later = withMembers(held("b"), [member("e")], {
            after: "d",
            moreMembersAfter: undefined,
        });
        expect(later.moreMembersAfter).toBe("b");
    });
});

describe("adding members to the cached details", () => {
    test("members are added to the cached details of a group", async () => {
        const stored = new Map<string, GroupChatDetails>();
        stored.set("chat", {
            members: [member("a")],
            moreMembersAfter: "a",
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            pinnedMessages: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            timestamp: 10n,
            bots: [],
            webhooks: [],
        });
        const cache = {
            getCachedGroupDetails: (k: string) => Promise.resolve(stored.get(k)),
            setCachedGroupDetails: (k: string, d: GroupChatDetails) => {
                stored.set(k, d);
                return Promise.resolve();
            },
            cachedGroupDetailsTimestamp: () => undefined,
        };

        await addMembersToCachedGroupDetails(cache, "chat", [member("b")], {
            after: "a",
            moreMembersAfter: undefined,
        });

        expect(memberIds(stored.get("chat"))).toEqual(["a", "b"]);
        expect(stored.get("chat")?.moreMembersAfter).toBeUndefined();
        // The details themselves are no more up to date than they were
        expect(stored.get("chat")?.timestamp).toBe(10n);

        // Nothing is cached for a chat whose details aren't
        await addMembersToCachedGroupDetails(cache, "other", [member("b")]);
        expect(stored.has("other")).toBe(false);
    });

    test("members are added to the cached details of a community", async () => {
        const stored = new Map<string, CommunityDetails>();
        stored.set("community", {
            kind: "success",
            members: [member("a")],
            moreMembersAfter: "a",
            blockedUsers: new Set(),
            invitedUsers: new Set(),
            rules: { text: "", enabled: false, version: 0 },
            lastUpdated: 10n,
            userGroups: new Map(),
            referrals: new Set(),
            bots: [],
        });
        const cache = {
            getCachedCommunityDetails: (k: string) => Promise.resolve(stored.get(k)),
            setCachedCommunityDetails: (k: string, d: CommunityDetails) => {
                stored.set(k, d);
                return Promise.resolve();
            },
            cachedCommunityDetailsTimestamp: () => undefined,
        };

        await addMembersToCachedCommunityDetails(cache, "community", [
            { ...member("b"), displayName: "B" },
        ]);

        expect(memberIds(stored.get("community"))).toEqual(["a", "b"]);
        expect(stored.get("community")?.moreMembersAfter).toBe("a");
        expect(stored.get("community")?.lastUpdated).toBe(10n);
    });
});
