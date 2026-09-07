import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WEBAUTHN_KEY_CACHE_DB_NAME, WEBAUTHN_KEY_CACHE_STORE_NAME } from "@shared";
import {
    ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS,
    buildAndroidPasskeySignInPayload,
    cachedAndroidCredentialIds,
    matchingCachedAndroidCredentialIds,
} from "./androidWebAuthn";

describe("Android WebAuthn cached credential rescue", () => {
    it("only reuses non-empty credential IDs cached for the active RP ID", () => {
        const matching = new Uint8Array([1, 2, 3]);
        expect(
            matchingCachedAndroidCredentialIds(
                [
                    { origin: "expected.example", credentialId: matching },
                    { origin: "other.example", credentialId: new Uint8Array([4]) },
                    { origin: "expected.example", credentialId: new Uint8Array() },
                    { origin: "expected.example", credentialId: new Uint8Array(1024) },
                    { origin: "expected.example", credentialId: [5, 6] },
                    null,
                ],
                "expected.example",
            ),
        ).toEqual([matching]);
    });

    it("encodes and deduplicates cached IDs for allowCredentials", () => {
        const challenge = new Uint8Array([9, 8, 7]).buffer;
        const credentialId = new Uint8Array([255, 0, 1]);
        expect(
            buildAndroidPasskeySignInPayload(challenge, [
                credentialId,
                new Uint8Array(credentialId),
            ]),
        ).toEqual({
            challenge,
            credentialIds: ["_wAB"],
        });
    });

    it("drops empty and oversized IDs before invoking Android", () => {
        expect(
            buildAndroidPasskeySignInPayload(new ArrayBuffer(0), [
                new Uint8Array(),
                new Uint8Array(1024),
            ]).credentialIds,
        ).toEqual([]);
    });
});

describe("bounded optional Android credential cache", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function fixture() {
        const request = {
            result: [] as unknown,
            onsuccess: undefined as (() => void) | undefined,
            onerror: undefined as (() => void) | undefined,
        };
        const getAll = vi.fn(() => request);
        const transaction = {
            abort: vi.fn(),
            objectStore: vi.fn(() => ({ getAll })),
            onabort: undefined as (() => void) | undefined,
        };
        const db = {
            close: vi.fn(),
            objectStoreNames: { contains: vi.fn(() => true) },
            transaction: vi.fn(() => transaction),
        };
        const openRequest = {
            result: db,
            transaction: { abort: vi.fn() },
            onsuccess: undefined as (() => void) | undefined,
            onerror: undefined as (() => void) | undefined,
            onblocked: undefined as (() => void) | undefined,
            onupgradeneeded: undefined as (() => void) | undefined,
        };
        const database = {
            databases: vi.fn(() => Promise.resolve([{ name: WEBAUTHN_KEY_CACHE_DB_NAME }])),
            open: vi.fn(() => openRequest),
            deleteDatabase: vi.fn(),
        };
        vi.stubGlobal("indexedDB", database);
        return { request, getAll, transaction, db, openRequest, database };
    }

    it.each([undefined, {}])("does not require optional IndexedDB enumeration: %s", async (api) => {
        vi.stubGlobal("indexedDB", api);
        await expect(cachedAndroidCredentialIds()).resolves.toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not open or create a cache that is absent", async () => {
        const f = fixture();
        f.database.databases.mockResolvedValue([]);
        await expect(cachedAndroidCredentialIds()).resolves.toEqual([]);
        expect(f.database.open).not.toHaveBeenCalled();
        expect(f.database.deleteDatabase).not.toHaveBeenCalled();
    });

    it("handles rejected database enumeration without preventing native sign-in", async () => {
        const f = fixture();
        f.database.databases.mockRejectedValue(new Error("unavailable"));
        await expect(cachedAndroidCredentialIds()).resolves.toEqual([]);
        expect(f.database.open).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("bounds stalled enumeration and ignores a late database list", async () => {
        const f = fixture();
        let complete!: (databases: { name: string }[]) => void;
        f.database.databases.mockImplementation(
            () =>
                new Promise((resolve) => {
                    complete = resolve;
                }),
        );
        const settled = vi.fn();
        const result = cachedAndroidCredentialIds();
        void result.then(settled);
        await vi.advanceTimersByTimeAsync(ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS - 1);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toEqual([]);
        complete([{ name: WEBAUTHN_KEY_CACHE_DB_NAME }]);
        await Promise.resolve();
        expect(f.database.open).not.toHaveBeenCalled();
        expect(settled).toHaveBeenCalledOnce();
    });

    it("handles synchronous open failure", async () => {
        const f = fixture();
        f.database.open.mockImplementation(() => {
            throw new Error("closed");
        });
        await expect(cachedAndroidCredentialIds()).resolves.toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["onerror", "onblocked"] as const)("finishes promptly on open %s", async (event) => {
        const f = fixture();
        const result = cachedAndroidCredentialIds();
        await Promise.resolve();
        f.openRequest[event]!();
        await expect(result).resolves.toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
        // An uncancellable open may succeed after timeout/blocked resolution; close it without reading.
        f.openRequest.onsuccess!();
        expect(f.db.close).toHaveBeenCalledOnce();
        expect(f.db.transaction).not.toHaveBeenCalled();
    });

    it("bounds a stalled open and closes a late connection", async () => {
        const f = fixture();
        const result = cachedAndroidCredentialIds();
        await vi.advanceTimersByTimeAsync(ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS);
        await expect(result).resolves.toEqual([]);
        f.openRequest.onsuccess!();
        expect(f.db.close).toHaveBeenCalledOnce();
        expect(f.db.transaction).not.toHaveBeenCalled();
    });

    it("aborts an unexpected upgrade instead of recreating account cache data", async () => {
        const f = fixture();
        const result = cachedAndroidCredentialIds();
        await Promise.resolve();
        f.openRequest.onupgradeneeded!();
        await expect(result).resolves.toEqual([]);
        expect(f.openRequest.transaction.abort).toHaveBeenCalledOnce();
        expect(f.database.open).toHaveBeenCalledExactlyOnceWith(WEBAUTHN_KEY_CACHE_DB_NAME);
        expect(f.database.deleteDatabase).not.toHaveBeenCalled();
        expect(f.db.transaction).not.toHaveBeenCalled();
    });

    it("uses one deadline across enumeration, open and entry reading", async () => {
        const f = fixture();
        const result = cachedAndroidCredentialIds();
        await vi.advanceTimersByTimeAsync(ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS - 10);
        f.openRequest.onsuccess!();
        await vi.advanceTimersByTimeAsync(10);
        await expect(result).resolves.toEqual([]);
        expect(f.transaction.abort).toHaveBeenCalledOnce();
        expect(f.db.close).toHaveBeenCalledOnce();
        f.request.onsuccess!();
        expect(f.db.close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("returns only matching RP IDs from a readonly transaction and closes the connection", async () => {
        const f = fixture();
        const matching = new Uint8Array([1, 2]);
        f.request.result = [
            { origin: import.meta.env.OC_ANDROID_RP_ID ?? "oc.app", credentialId: matching },
            { origin: "other.example", credentialId: new Uint8Array([3]) },
        ];
        const result = cachedAndroidCredentialIds();
        await Promise.resolve();
        f.openRequest.onsuccess!();
        f.request.onsuccess!();
        await expect(result).resolves.toEqual([matching]);
        expect(f.db.transaction).toHaveBeenCalledExactlyOnceWith(
            WEBAUTHN_KEY_CACHE_STORE_NAME,
            "readonly",
        );
        expect(f.transaction.objectStore).toHaveBeenCalledExactlyOnceWith(
            WEBAUTHN_KEY_CACHE_STORE_NAME,
        );
        expect(f.transaction.abort).not.toHaveBeenCalled();
        expect(f.db.close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("still closes when the timed-out transaction has already finished", async () => {
        const f = fixture();
        f.transaction.abort.mockImplementation(() => {
            throw new DOMException("finished", "InvalidStateError");
        });
        const result = cachedAndroidCredentialIds();
        await Promise.resolve();
        f.openRequest.onsuccess!();
        await vi.advanceTimersByTimeAsync(ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS);
        await expect(result).resolves.toEqual([]);
        expect(f.db.close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["read-error", "aborted", "missing-store", "transaction-error", "malformed-entries"])(
        "closes the connection when cache access fails: %s",
        async (failure) => {
            const f = fixture();
            if (failure === "missing-store") f.db.objectStoreNames.contains.mockReturnValue(false);
            if (failure === "transaction-error")
                f.db.transaction.mockImplementation(() => {
                    throw new Error("inactive");
                });
            const result = cachedAndroidCredentialIds();
            await Promise.resolve();
            f.openRequest.onsuccess!();
            if (failure === "read-error") f.request.onerror!();
            if (failure === "aborted") f.transaction.onabort!();
            if (failure === "malformed-entries") {
                f.request.result = null;
                f.request.onsuccess!();
            }
            await expect(result).resolves.toEqual([]);
            expect(f.db.close).toHaveBeenCalledOnce();
            expect(vi.getTimerCount()).toBe(0);
            expect(f.database.deleteDatabase).not.toHaveBeenCalled();
        },
    );
});
