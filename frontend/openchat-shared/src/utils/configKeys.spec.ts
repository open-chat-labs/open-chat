import { describe, expect, it } from "vitest";
import { configKeys } from "./configKeys";

describe("configKeys", () => {
    /** Invariant: no two settings share a localStorage key. */
    it("gives every setting its own key", () => {
        const keys = Object.values(configKeys);
        expect(new Set(keys).size).toBe(keys.length);
    });

    /** Invariant: the last crypto sent is read from the key the client has written since the v2 change. */
    it("keeps lastCryptoSent on its v2 key", () => {
        expect(configKeys.lastCryptoSent).toBe("openchat_lastcryptosent_v2");
    });
});
