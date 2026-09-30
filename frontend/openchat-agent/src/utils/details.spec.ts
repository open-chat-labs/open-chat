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
    confirmHeldDetails,
    loadCommunityDetails,
    loadGroupDetails,
    type DetailsUpdatesOutcome,
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

    function setup(
        cached: GroupChatDetails | undefined,
        updates?: GroupChatDetailsUpdatesResponse,
    ) {
        const stored = new Map<string, GroupChatDetails>();
        if (cached !== undefined) stored.set(key, cached);
        const cache = {
            getCachedGroupDetails: vi.fn((k: string) => Promise.resolve(stored.get(k))),
            setCachedGroupDetails: vi.fn((k: string, d: GroupChatDetails) => {
                stored.set(k, d);
                return Promise.resolve();
            }),
        };
        const initial = vi.fn(() => Promise.resolve(details(10n, ["a", "b"])));
        const updatesSince = vi.fn((_since: bigint) =>
            Promise.resolve(updates ?? { kind: "failure" as const }),
        );
        const load = (chatLastUpdated: bigint, heldTimestamp?: bigint) =>
            loadGroupDetails(cache, key, chatLastUpdated, heldTimestamp, initial, updatesSince);
        return { stored, cache, initial, updatesSince, load };
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
            details(10n, ["a"]),
            membersAdded(20n, ["b"]),
        );

        const resp = await load(20n);

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

    test("held details which haven't changed are confirmed without touching the cache", async () => {
        const { load, cache, updatesSince } = setup(details(10n, ["a"]), {
            kind: "success_no_updates",
            timestamp: 30n,
        });

        expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", timestamp: 30n });
        expect(updatesSince).toHaveBeenCalledWith(20n);
        expect(cache.getCachedGroupDetails).not.toHaveBeenCalled();
        expect(cache.setCachedGroupDetails).not.toHaveBeenCalled();
    });

    test("held details which have changed are loaded from the cache and brought up to date", async () => {
        const { load, stored, updatesSince } = setup(details(10n, ["a"]), membersAdded(30n, ["b"]));

        const resp = await load(30n, 20n);

        // First asked whether the held details have changed, then for the updates since the
        // details were cached
        expect(updatesSince.mock.calls).toEqual([[20n], [10n]]);
        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(stored.get(key)?.timestamp).toBe(30n);
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
        const cache = {
            getCachedCommunityDetails: vi.fn((k: string) => Promise.resolve(stored.get(k))),
            setCachedCommunityDetails: vi.fn((k: string, d: CommunityDetails) => {
                stored.set(k, d);
                return Promise.resolve();
            }),
        };
        const initial = vi.fn(() => Promise.resolve(details(10n, ["a", "b"])));
        const updatesSince = vi.fn((_since: bigint) =>
            Promise.resolve(updates ?? { kind: "failure" as const }),
        );
        const load = (communityLastUpdated: bigint, heldTimestamp?: bigint) =>
            loadCommunityDetails(
                cache,
                id,
                communityLastUpdated,
                heldTimestamp,
                initial,
                updatesSince,
            );
        return { stored, cache, initial, updatesSince, load };
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

    test("held details which haven't changed are confirmed without touching the cache", async () => {
        const { load, cache, updatesSince } = setup(details(10n, ["a"]), {
            kind: "success_no_updates",
            lastUpdated: 30n,
        });

        expect(await load(30n, 20n)).toEqual({ kind: "success_no_updates", lastUpdated: 30n });
        expect(updatesSince).toHaveBeenCalledWith(20n);
        expect(cache.getCachedCommunityDetails).not.toHaveBeenCalled();
        expect(cache.setCachedCommunityDetails).not.toHaveBeenCalled();
    });

    test("held details which have changed are loaded from the cache and brought up to date", async () => {
        const { load, stored, updatesSince } = setup(details(10n, ["a"]), membersAdded(30n, ["b"]));

        const resp = await load(30n, 20n);

        expect(updatesSince.mock.calls).toEqual([[20n], [10n]]);
        expect(memberIds(resp)).toEqual(["a", "b"]);
        expect(stored.get(id)?.lastUpdated).toBe(30n);
    });
});

describe("confirmHeldDetails", () => {
    function updatesSince(outcome: DetailsUpdatesOutcome) {
        return vi.fn((_since: bigint) => Promise.resolve(outcome));
    }

    test("details already as new as the summary are good without asking the canister", async () => {
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 10n, query)).toEqual(10n);
        expect(query).not.toHaveBeenCalled();
    });

    test("details are kept as they are while offline", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
        expect(query).not.toHaveBeenCalled();
    });

    test("unchanged details are good up to the canister's timestamp", async () => {
        const query = updatesSince({ kind: "success_no_updates", timestamp: 20n });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(20n);
        expect(query).toHaveBeenCalledWith(10n);
    });

    test("a lagging replica's timestamp doesn't move the details backwards", async () => {
        const query = updatesSince({ kind: "success_no_updates", timestamp: 5n });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
    });

    test("details are kept as they are if the canister can't be reached", async () => {
        const query = updatesSince({ kind: "failure" });

        expect(await confirmHeldDetails(10n, 20n, query)).toEqual(10n);
    });

    test("changed details must be loaded in full", async () => {
        const query = updatesSince({ kind: "success" });

        expect(await confirmHeldDetails(10n, 20n, query)).toBeUndefined();
    });
});
