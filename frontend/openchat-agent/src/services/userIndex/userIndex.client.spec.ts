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

function cachedUser(userId: string): UserSummary {
    return {
        kind: "user",
        userId,
        username: userId,
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
const LATEST = "dfdal-2uaaa-aaaaa-qaama-cai";
// The user's id, and that of an account they deleted before creating it on the same principal
const ME = "rno2w-sqaaa-aaaaa-aaacq-cai";
const ME_DELETED = "renrk-eyaaa-aaaaa-aaada-cai";

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
        setup();
        respond = () => ({ users: [fullUpdate(LATEST, "fresh", [OLD])] });

        const resp = await client.getUsers(args(OLD), false);
        await flush();

        expect(resp.users.map((u) => [u.userId, u.username])).toEqual([[LATEST, "fresh"]]);
        expect(resp.migratedUserIds).toEqual(new Map([[OLD, LATEST]]));
        expect([...stores.get("users")!.keys()]).toEqual([LATEST]);
    });

    test("a user requested by several ids is returned once", async () => {
        setup();
        respond = () => ({ users: [fullUpdate(LATEST, "fresh", [OLD])] });

        const resp = await client.getUsers(args(OLD, LATEST), false);

        expect(requests).toEqual([[OLD, LATEST]]);
        expect(resp.users.map((u) => u.userId)).toEqual([LATEST]);
        expect(resp.migratedUserIds).toEqual(new Map([[OLD, LATEST]]));
    });

    test.each([
        ["reported deleted", new Set([ME_DELETED])],
        ["not reported deleted", new Set<string>()],
    ])(
        "the current user returned under a different id, the old one %s, isn't taken to have been migrated",
        async (_, deletedUserIds) => {
            setup();
            cachedCurrentUser = { ...anonymousUser(), userId: ME_DELETED };
            respond = () => ({
                currentUser: currentUserSummary(ME),
                deletedUserIds,
            });

            const resp = await client.getUsers(args(ME_DELETED, ME), false);

            // The current user is cached before getUsers returns, for the client to restart under
            expect(cachedCurrentUser?.userId).toEqual(ME);
            expect(resp.users.map((u) => u.userId)).toEqual([ME]);
            expect(resp.migratedUserIds).toBeUndefined();
        },
    );

    test("getCurrentUser under a new account forgets the old one's chat state before returning it", async () => {
        setup();
        cachedCurrentUser = { ...anonymousUser(), userId: ME_DELETED };
        liveCurrentUser = { ...anonymousUser(), userId: ME };

        const results = await new Promise<string[]>((resolve) => {
            const ids: string[] = [];
            client.getCurrentUser().subscribe({
                onResult: (user, final) => {
                    if (user.kind === "created_user") ids.push(user.userId);
                    if (final) resolve(ids);
                },
            });
        });

        // Everything the restarted session relies on is done before the new user is returned
        expect(results).toEqual([ME_DELETED, ME]);
        expect(cachedCurrentUser?.userId).toEqual(ME);
        expect(chatStateForgotten).toBe(true);
    });

    test("getCurrentUser leaves the cache alone when the id hasn't changed", async () => {
        setup();
        cachedCurrentUser = { ...anonymousUser(), userId: ME };
        liveCurrentUser = { ...anonymousUser(), userId: ME };

        await new Promise<void>((resolve) =>
            client.getCurrentUser().subscribe({ onResult: (_, final) => final && resolve() }),
        );
        await flush();

        expect(chatStateForgotten).toBe(false);
    });

    test("populateUserCache drops ids that are not principals", async () => {
        setup();

        await client.populateUserCache(["n", LATEST]);

        expect(requests).toEqual([[LATEST]]);
    });

    test("users who haven't been migrated are unaffected", async () => {
        setup({ users: { [OLD]: cachedUser(OLD) } });

        const resp = await client.getUsers(args(OLD), false);

        expect(requests).toEqual([[OLD]]);
        expect(resp.users.map((u) => [u.userId, u.updated])).toEqual([[OLD, SERVER_TIMESTAMP]]);
        expect(resp.migratedUserIds).toBeUndefined();
    });
});
