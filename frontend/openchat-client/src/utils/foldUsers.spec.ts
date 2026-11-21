import { describe, expect, test, vi } from "vitest";
import { FEW_MISSING_USERS, FIRST_LIST_USERS_WAIT_MS, FoldUsers } from "./foldUsers";

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (err: Error) => void };
function deferred(): Deferred {
    let resolve!: () => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// A user store, a cache and a network the tests drive by hand
function setUp(chatsBeforeUsers = true, cachedIds: string[] = []) {
    const store = new Set<string>();
    const cached = new Set(cachedIds);
    const fetches: { userIds: string[]; done: Deferred }[] = [];
    const delays: { ms: number; done: Deferred }[] = [];
    // what was last announced as loading
    const loading = { current: new Set<string>() as ReadonlySet<string> };
    const foldUsers = new FoldUsers({
        chatsBeforeUsers,
        missing: (userIds) => [...userIds].filter((u) => !store.has(u)),
        lookUpCached: vi.fn(async (userIds: string[]) => {
            for (const u of userIds) if (cached.has(u)) store.add(u);
        }),
        fetch: (userIds) => {
            const done = deferred();
            fetches.push({ userIds, done });
            return done.promise.then(() => userIds.forEach((u) => store.add(u)));
        },
        delay: (ms) => {
            const done = deferred();
            delays.push({ ms, done });
            return done.promise;
        },
        onLoading: (userIds) => (loading.current = userIds),
    });
    return { foldUsers, store, fetches, delays, loading };
}

// Whether `promise` has settled once pending callbacks have run
async function settled(promise: Promise<unknown>): Promise<boolean> {
    let done = false;
    promise.then(
        () => (done = true),
        () => (done = true),
    );
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return done;
}

const ids = (n: number, prefix = "u") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("FoldUsers", () => {
    test("the old trees wait for every missing user, on the first fold too", async () => {
        const { foldUsers, fetches, store } = setUp(false, ["a"]);
        store.add("me");
        const load = foldUsers.load(new Set(["me", "a", "b"]), true, "me");
        expect(await settled(load)).toBe(false);
        expect(fetches.map((f) => f.userIds)).toEqual([["a", "b"]]);
        fetches[0].done.resolve();
        expect(await settled(load)).toBe(true);
    });

    test("the first list shows straight away when the cache holds everyone", async () => {
        const { foldUsers, fetches } = setUp(true, ["me", "a", "b"]);
        await foldUsers.load(new Set(["me", "a", "b"]), true, "me");
        expect(fetches).toEqual([]);
    });

    test("the first list doesn't wait for a few users the cache lacks", async () => {
        const { foldUsers, fetches, store } = setUp(true, ["me"]);
        const { arrived } = await foldUsers.load(new Set(["me", "a", "b"]), true, "me");
        expect(fetches.map((f) => f.userIds)).toEqual([["a", "b"]]);
        expect(await settled(arrived)).toBe(false);
        fetches[0].done.resolve();
        await arrived;
        expect(store.has("a")).toBe(true);
    });

    test("the first list waits, for a while at most, when many users aren't cached", async () => {
        const { foldUsers, fetches, delays } = setUp(true, ["me"]);
        const load = foldUsers.load(new Set(["me", ...ids(FEW_MISSING_USERS + 1)]), true, "me");
        expect(await settled(load)).toBe(false);
        expect(delays.map((d) => d.ms)).toEqual([FIRST_LIST_USERS_WAIT_MS]);
        delays[0].done.resolve();
        expect(await settled(load)).toBe(true);
        expect(await settled((await load).arrived)).toBe(false);
        fetches[0].done.resolve();
    });

    test("the first list waits no longer than the users take to arrive", async () => {
        const { foldUsers, fetches } = setUp(true, []);
        const load = foldUsers.load(new Set(["me"]), true, "me");
        expect(await settled(load)).toBe(false);
        fetches[0].done.resolve();
        expect(await settled(load)).toBe(true);
    });

    test("the first list waits for the current user when the cache lacks them", async () => {
        const { foldUsers, delays } = setUp(true, ["a"]);
        const load = foldUsers.load(new Set(["me", "a"]), true, "me");
        expect(await settled(load)).toBe(false);
        expect(delays).toHaveLength(1);
    });

    test("a later fold waits for its users, reusing a fetch still in flight", async () => {
        const { foldUsers, fetches } = setUp(true, ["me"]);
        await foldUsers.load(new Set(["me", "a"]), true, "me");
        const later = foldUsers.load(new Set(["a", "b"]), false, "me");
        expect(await settled(later)).toBe(false);
        expect(fetches.map((f) => f.userIds)).toEqual([["a"], ["b"]]);
        fetches[1].done.resolve();
        expect(await settled(later)).toBe(false);
        fetches[0].done.resolve();
        expect(await settled(later)).toBe(true);
    });

    test("a failed fetch or cache look-up doesn't fail the fold", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const foldUsers = new FoldUsers({
            chatsBeforeUsers: true,
            missing: (userIds) => [...userIds],
            lookUpCached: () => Promise.reject(new Error("no cache")),
            fetch: () => Promise.reject(new Error("offline")),
            delay: () => new Promise(() => {}),
            onLoading: () => {},
        });
        const { arrived } = await foldUsers.load(new Set(["me"]), true, "me");
        await expect(arrived).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    test("announces the users being fetched as loading until their fetch settles", async () => {
        const { foldUsers, fetches, loading } = setUp(true, ["me"]);
        await foldUsers.load(new Set(["me", "a", "b"]), true, "me");
        expect([...loading.current].sort()).toEqual(["a", "b"]);
        const later = foldUsers.load(new Set(["c"]), false, "me");
        await settled(later);
        expect([...loading.current].sort()).toEqual(["a", "b", "c"]);
        fetches[0].done.resolve();
        await settled(later);
        expect([...loading.current]).toEqual(["c"]);
        fetches[1].done.resolve();
        await later;
        expect(loading.current.size).toBe(0);
    });

    test("a user whose fetch fails is no longer loading", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { foldUsers, fetches, loading } = setUp(true, ["me"]);
        const { arrived } = await foldUsers.load(new Set(["me", "a"]), true, "me");
        expect([...loading.current]).toEqual(["a"]);
        fetches[0].done.reject(new Error("timed out"));
        await arrived;
        expect(loading.current.size).toBe(0);
        warn.mockRestore();
    });

    test("the old trees announce no one as loading", async () => {
        const { foldUsers, fetches, loading } = setUp(false, []);
        const load = foldUsers.load(new Set(["a"]), true, "me");
        await settled(load);
        expect(fetches).toHaveLength(1);
        expect(loading.current.size).toBe(0);
        fetches[0].done.resolve();
        await load;
    });
});
