import { describe, expect, test, vi } from "vitest";
import { usersForFold } from "./foldUsers";

const never = () => new Promise<never>(() => {});

describe("usersForFold", () => {
    test("the initial load doesn't wait for the missing users to arrive", async () => {
        const fetchMissing = vi.fn(never);
        await usersForFold(true, Promise.resolve(), fetchMissing);
        expect(fetchMissing).toHaveBeenCalledOnce();
    });

    test("the initial load looks for missing users only once the cached users are in", async () => {
        let loadCached!: () => void;
        const cachedUsersLoaded = new Promise<void>((resolve) => (loadCached = resolve));
        const fetchMissing = vi.fn(() => Promise.resolve());
        let settled = false;
        const fold = usersForFold(true, cachedUsersLoaded, fetchMissing).then(
            () => (settled = true),
        );
        await Promise.resolve();
        expect(fetchMissing).not.toHaveBeenCalled();
        expect(settled).toBe(false);
        loadCached();
        await fold;
        expect(fetchMissing).toHaveBeenCalledOnce();
    });

    test("the initial load goes on when the cached users fail to load", async () => {
        const fetchMissing = vi.fn(() => Promise.resolve());
        await usersForFold(true, Promise.reject(new Error("no cache")), fetchMissing);
        expect(fetchMissing).toHaveBeenCalledOnce();
    });

    test("a failed fetch on the initial load doesn't fail the fold", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(
            usersForFold(true, Promise.resolve(), () => Promise.reject(new Error("offline"))),
        ).resolves.toBeUndefined();
        await Promise.resolve();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    test("a later answer waits for its missing users", async () => {
        let deliver!: () => void;
        const fetchMissing = vi.fn(() => new Promise<void>((resolve) => (deliver = resolve)));
        let settled = false;
        const fold = usersForFold(false, never(), fetchMissing).then(() => (settled = true));
        await Promise.resolve();
        expect(fetchMissing).toHaveBeenCalledOnce();
        expect(settled).toBe(false);
        deliver();
        await fold;
        expect(settled).toBe(true);
    });
});
