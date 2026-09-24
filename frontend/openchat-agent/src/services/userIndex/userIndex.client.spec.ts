import {
    anonymousUser,
    type CreatedUser,
    type CurrentUserSummary,
    type UsersApiResponse,
    type UsersArgs,
    type UserSummary,
    type UserSummaryUpdate,
} from "@shared";
import { beforeEach, describe, expect, test } from "vitest";
import { fakeIdb } from "../../utils/fakeIdb";
import { UserDb } from "../../utils/userCache";
import { UserIndexClient } from "./userIndex.client";

const SERVER_TIMESTAMP = 1000n;

function cachedUser(userId: string, username = userId): UserSummary {
    return {
        kind: "user",
        userId,
        username,
        displayName: undefined,
        updated: 10n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };
}

function fullUpdate(
    userId: string,
    username: string,
    previousUserIds?: string[],
): UserSummaryUpdate {
    return {
        userId,
        stable: {
            username,
            diamondStatus: "inactive",
            isBot: false,
            displayName: undefined,
            suspended: false,
            isUniquePerson: false,
            hideOnlineStatus: false,
        },
        volatile: { streak: 1, maxStreak: 2, chitBalance: 3, totalChitEarned: 4 },
        previousUserIds,
    };
}

function currentUserSummary(userId: string): CurrentUserSummary {
    return {
        ...anonymousUser(),
        kind: "current_user_summary",
        userId,
        username: "me",
    } as CurrentUserSummary;
}

function args(...userIds: string[]): UsersArgs {
    return { userGroups: [{ users: userIds, updatedSince: 0n }] };
}

// Real user ids are principals, which getUsers insists on
const OLD = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const OLDER = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const LATEST = "dfdal-2uaaa-aaaaa-qaama-cai";
const ME_OLD = "renrk-eyaaa-aaaaa-aaada-cai";
const ME_LATEST = "rno2w-sqaaa-aaaaa-aaacq-cai";

describe("UserIndexClient.getUsers with migrated users", () => {
    let stores: Map<string, Map<string, unknown>>;
    let requests: string[][];
    let respond: (requested: string[]) => Partial<UsersApiResponse>;
    let cachedCurrentUser: CreatedUser | undefined;
    let chatStateForgotten: boolean;
    let liveCurrentUser: CreatedUser;
    let client: UserIndexClient;

    function setup(initial: Record<string, Record<string, unknown>> = {}) {
        const fake = fakeIdb(initial);
        stores = fake.stores;
        const userDb = new UserDb();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (userDb as any).connectionManager = { getDb: () => Promise.resolve(fake.db) };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = Object.create(UserIndexClient.prototype) as any;
        c.userDb = userDb;
        // Its writes take a while to land, as IndexedDB's do, so that a test fails if getUsers
        // returns before they've landed
        c.chatsDb = {
            getCachedCurrentUser: () => Promise.resolve(cachedCurrentUser),
            mergeCachedCurrentUser: (u: CurrentUserSummary) =>
                slowly(() => {
                    cachedCurrentUser = { ...cachedCurrentUser!, ...u, kind: "created_user" };
                }),
            setCachedCurrentUser: (u: CreatedUser) => slowly(() => (cachedCurrentUser = u)),
            forgetCachedChatState: () => slowly(() => (chatStateForgotten = true)),
        };
        c.query = () => Promise.resolve(liveCurrentUser);
        c.getUsersFromBackend = (users: UsersArgs): Promise<UsersApiResponse> => {
            const requested = users.userGroups.flatMap((g) => g.users);
            requests.push(requested);
            return Promise.resolve({
                serverTimestamp: SERVER_TIMESTAMP,
                users: [],
                deletedUserIds: new Set(),
                ...respond(requested),
            });
        };
        client = c;
    }

    // The cache writes aren't awaited by getUsers
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const slowly = (write: () => void) =>
        new Promise<void>((resolve) =>
            setTimeout(() => {
                write();
                resolve();
            }, 5),
        );

    beforeEach(() => {
        requests = [];
        respond = () => ({});
        cachedCurrentUser = undefined;
        chatStateForgotten = false;
    });

    test("a user requested by an earlier id is returned and cached under their latest id", async () => {
        setup({ users: { [OLD]: cachedUser(OLD, "stale") } });
        respond = () => ({ users: [fullUpdate(LATEST, "fresh", [OLD])] });

        const resp = await client.getUsers(args(OLD), false);
        await flush();

        expect(resp.users.map((u) => [u.userId, u.username])).toEqual([[LATEST, "fresh"]]);
        expect(resp.migratedUserIds).toEqual(new Map([[OLD, LATEST]]));
        expect([...stores.get("users")!.keys()]).toEqual([LATEST]);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[OLD, LATEST]]));
    });

    test("once the mapping is cached, the latest id is requested instead of the earlier one", async () => {
        setup({
            users: { [LATEST]: cachedUser(LATEST) },
            migratedUserIds: { [OLD]: LATEST },
        });

        const resp = await client.getUsers(args(OLD), false);

        expect(requests).toEqual([[LATEST]]);
        expect(resp.users.map((u) => u.userId)).toEqual([LATEST]);
        expect(resp.migratedUserIds).toEqual(new Map([[OLD, LATEST]]));
    });

    test("a user requested by several ids is returned once", async () => {
        setup({ migratedUserIds: { [OLDER]: OLD } });
        respond = () => ({ users: [fullUpdate(LATEST, "fresh", [OLD])] });

        const resp = await client.getUsers(args(OLDER, OLD, LATEST), false);
        await flush();

        expect(requests).toEqual([[OLD, LATEST]]);
        expect(resp.users.map((u) => u.userId)).toEqual([LATEST]);
        expect(resp.migratedUserIds).toEqual(
            new Map([
                [OLD, LATEST],
                [OLDER, LATEST],
            ]),
        );
    });

    test("a deleted user is reported as deleted under the id they were requested by", async () => {
        setup({ migratedUserIds: { [OLD]: LATEST } });
        respond = () => ({ deletedUserIds: new Set([LATEST]) });

        const resp = await client.getUsers(args(OLD), false);

        expect(resp.deletedUserIds).toEqual(new Set([LATEST, OLD]));
    });

    test("the current user returned under a new id replaces the entry under their old one", async () => {
        setup({ users: { [ME_OLD]: cachedUser(ME_OLD) } });
        cachedCurrentUser = { ...anonymousUser(), userId: ME_OLD };
        respond = () => ({ currentUser: currentUserSummary(ME_LATEST) });

        const resp = await client.getUsers(args(ME_OLD), false);

        expect(resp.users.map((u) => u.userId)).toEqual([ME_LATEST]);
        expect(resp.currentUser?.userId).toEqual(ME_LATEST);
        expect(resp.migratedUserIds).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        // Everything the restarted session relies on is cached before getUsers returns
        expect(cachedCurrentUser?.userId).toEqual(ME_LATEST);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        expect(chatStateForgotten).toBe(true);
        await flush();
        expect([...stores.get("users")!.keys()]).toEqual([ME_LATEST]);
    });

    test("the current user's migration recorded while the request was in flight is applied", async () => {
        setup({ users: { [ME_OLD]: cachedUser(ME_OLD) } });
        cachedCurrentUser = { ...anonymousUser(), userId: ME_OLD };
        respond = () => {
            // As getCurrentUser does on finding the user's id has changed
            cachedCurrentUser = { ...anonymousUser(), userId: ME_LATEST };
            stores.set("migratedUserIds", new Map([[ME_OLD, ME_LATEST]]));
            stores.get("users")!.delete(ME_OLD);
            return { currentUser: currentUserSummary(ME_LATEST) };
        };

        const resp = await client.getUsers(args(ME_OLD), false);
        await flush();

        expect(resp.users.map((u) => u.userId)).toEqual([ME_LATEST]);
        expect(resp.migratedUserIds).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        expect([...stores.get("users")!.keys()]).toEqual([ME_LATEST]);
    });

    test("the current user under an id they've been migrated from is out of date and ignored", async () => {
        setup({
            users: { [ME_LATEST]: cachedUser(ME_LATEST) },
            migratedUserIds: { [ME_OLD]: ME_LATEST },
        });
        cachedCurrentUser = { ...anonymousUser(), userId: ME_LATEST };
        // From a replica which hasn't caught up with the migration
        respond = () => ({ currentUser: currentUserSummary(ME_OLD) });

        const resp = await client.getUsers(args(ME_LATEST), false);
        await flush();

        expect(resp.currentUser).toBeUndefined();
        expect(resp.users.map((u) => u.userId)).toEqual([ME_LATEST]);
        expect(cachedCurrentUser?.userId).toEqual(ME_LATEST);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        expect(chatStateForgotten).toBe(false);
    });

    test("getCurrentUser ignores a live user under an id they've been migrated from", async () => {
        setup({ migratedUserIds: { [ME_OLD]: ME_LATEST } });
        cachedCurrentUser = { ...anonymousUser(), userId: ME_LATEST };
        liveCurrentUser = { ...anonymousUser(), userId: ME_OLD };

        const results = await new Promise<string[]>((resolve) => {
            const ids: string[] = [];
            client.getCurrentUser().subscribe({
                onResult: (user, final) => {
                    if (user.kind === "created_user") ids.push(user.userId);
                    if (final) resolve(ids);
                },
            });
        });
        await flush();

        expect(results).toEqual([ME_LATEST, ME_LATEST]);
        expect(cachedCurrentUser?.userId).toEqual(ME_LATEST);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        expect(chatStateForgotten).toBe(false);
    });

    test("a current user whose old id was deleted is a new account, not a migration", async () => {
        setup();
        cachedCurrentUser = { ...anonymousUser(), userId: ME_OLD };
        respond = () => ({
            currentUser: currentUserSummary(ME_LATEST),
            deletedUserIds: new Set([ME_OLD]),
        });

        const resp = await client.getUsers(args(ME_OLD), false);
        await flush();

        expect(resp.migratedUserIds).toBeUndefined();
        expect(stores.get("migratedUserIds")?.size ?? 0).toBe(0);
        expect(chatStateForgotten).toBe(false);
    });

    test("getCurrentUser caches everything for the new id before returning it", async () => {
        setup({ users: { [ME_OLD]: cachedUser(ME_OLD) } });
        cachedCurrentUser = { ...anonymousUser(), userId: ME_OLD };
        liveCurrentUser = { ...anonymousUser(), userId: ME_LATEST };

        const results = await new Promise<string[]>((resolve) => {
            const ids: string[] = [];
            client.getCurrentUser().subscribe({
                onResult: (user, final) => {
                    if (user.kind === "created_user") ids.push(user.userId);
                    if (final) resolve(ids);
                },
            });
        });

        expect(results).toEqual([ME_OLD, ME_LATEST]);
        expect(cachedCurrentUser?.userId).toEqual(ME_LATEST);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[ME_OLD, ME_LATEST]]));
        expect(stores.get("users")!.has(ME_OLD)).toBe(false);
        expect(chatStateForgotten).toBe(true);
    });

    test("getCurrentUser leaves the cache alone when the id hasn't changed", async () => {
        setup();
        cachedCurrentUser = { ...anonymousUser(), userId: ME_OLD };
        liveCurrentUser = { ...anonymousUser(), userId: ME_OLD };

        await new Promise<void>((resolve) =>
            client.getCurrentUser().subscribe({ onResult: (_, final) => final && resolve() }),
        );
        await flush();

        expect(stores.get("migratedUserIds")?.size ?? 0).toBe(0);
        expect(chatStateForgotten).toBe(false);
    });

    test("populateUserCache requests latest ids and marks the requested id deleted", async () => {
        setup({ migratedUserIds: { [OLD]: LATEST } });
        respond = () => ({ deletedUserIds: new Set([LATEST]) });

        await client.populateUserCache([OLD]);
        await flush();

        expect(requests).toEqual([[LATEST]]);
        expect(stores.get("deletedUserIds")).toEqual(
            new Map([
                [LATEST, LATEST],
                [OLD, OLD],
            ]),
        );
    });

    test("populateUserCache caches a user under their latest id", async () => {
        setup();
        respond = () => ({ users: [fullUpdate(LATEST, "fresh", [OLD])] });

        await client.populateUserCache([OLD]);
        await flush();

        expect([...stores.get("users")!.keys()]).toEqual([LATEST]);
        expect(stores.get("migratedUserIds")).toEqual(new Map([[OLD, LATEST]]));
    });

    test("users who haven't been migrated are unaffected", async () => {
        setup({ users: { [OLD]: cachedUser(OLD) } });

        const resp = await client.getUsers(args(OLD), false);

        expect(requests).toEqual([[OLD]]);
        expect(resp.users.map((u) => [u.userId, u.updated])).toEqual([[OLD, SERVER_TIMESTAMP]]);
        expect(resp.migratedUserIds).toBeUndefined();
    });
});
