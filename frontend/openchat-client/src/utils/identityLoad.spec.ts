import { describe, expect, test } from "vitest";
import { identityLoadFailed } from "./identityLoad";

describe("identityLoadFailed", () => {
    test("a loaded identity, or a sign-out, isn't a failure", () => {
        expect(identityLoadFailed("loaded", 1, 1)).toBe(false);
        expect(identityLoadFailed("signed_out", 1, 1)).toBe(false);
    });

    test("a load that threw, or a user that couldn't be loaded, is", () => {
        expect(identityLoadFailed("threw", 1, 1)).toBe(true);
        expect(identityLoadFailed("user_load_failed", 3, 3)).toBe(true);
    });

    test("a load a newer one has replaced (a sign-in during start-up) says nothing", () => {
        expect(identityLoadFailed("threw", 1, 2)).toBe(false);
        expect(identityLoadFailed("user_load_failed", 1, 2)).toBe(false);
    });
});
