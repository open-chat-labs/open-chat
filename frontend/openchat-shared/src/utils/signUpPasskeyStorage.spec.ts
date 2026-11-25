import type { AuthClientStorage } from "@icp-sdk/auth/client";
import { describe, expect, test } from "vitest";
import {
    getSignUpPasskey,
    removeSignUpPasskey,
    storeSignUpInterrupted,
    storeSignUpPasskey,
    takeSignUpInterrupted,
} from "./signUpPasskeyStorage";

function memoryStorage(): AuthClientStorage & { values: Map<string, unknown> } {
    const values = new Map<string, unknown>();
    return {
        values,
        get: async (key) => (values.get(key) ?? null) as never,
        set: async (key, value) => {
            values.set(key, value);
        },
        remove: async (key) => {
            values.delete(key);
        },
    };
}

describe("the sign-up's passkey, kept over a reload", () => {
    test("is read back as it was stored", async () => {
        const storage = memoryStorage();
        await storeSignUpPasskey(storage, {
            authPrincipal: "p",
            credentialId: Uint8Array.from([1, 2, 255]),
        });

        const passkey = await getSignUpPasskey(storage);
        expect(passkey?.authPrincipal).toBe("p");
        expect(Array.from(passkey?.credentialId ?? [])).toEqual([1, 2, 255]);
    });

    test("is gone once removed", async () => {
        const storage = memoryStorage();
        await storeSignUpPasskey(storage, {
            authPrincipal: "p",
            credentialId: Uint8Array.from([1]),
        });
        await removeSignUpPasskey(storage);
        expect(await getSignUpPasskey(storage)).toBeUndefined();
    });

    test("one that can't be read counts as none", async () => {
        const storage = memoryStorage();
        storage.values.set("sign_up_passkey", "not json");
        expect(await getSignUpPasskey(storage)).toBeUndefined();
        storage.values.set("sign_up_passkey", JSON.stringify({ authPrincipal: 1 }));
        expect(await getSignUpPasskey(storage)).toBeUndefined();
    });
});

describe("an interrupted sign-up", () => {
    test("is told once", async () => {
        const storage = memoryStorage();
        expect(await takeSignUpInterrupted(storage)).toBe(false);
        await storeSignUpInterrupted(storage);
        expect(await takeSignUpInterrupted(storage)).toBe(true);
        expect(await takeSignUpInterrupted(storage)).toBe(false);
    });
});
