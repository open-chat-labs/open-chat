// Characterisation tests for the worker-side identicon generation that runs for
// every avatarless user on every getUsers cycle and for the whole user cache at
// startup. They pin down the CURRENT output so that memoising it cannot change
// what the main thread receives.
import { OPENCHAT_BOT_AVATAR_URL, OPENCHAT_BOT_USER_ID } from "@shared";
import { buildIdenticonUrl, buildUserAvatarUrl } from "./chat";

// Captured from the unmemoised implementation.
const XYZ_IDENTICON =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCcgc3R5bGU9J2JhY2tncm91bmQtY29sb3I6cmdiYSgyNDAsMjQwLDI0MCwxKTsnPjxnIHN0eWxlPSdmaWxsOnJnYmEoMjE3LDE1MSwzOCwxKTsgc3Ryb2tlOnJnYmEoMjE3LDE1MSwzOCwxKTsgc3Ryb2tlLXdpZHRoOjAuMzI7Jz48cmVjdCAgeD0nMjYnIHk9JzI2JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMTQnIHk9JzE0JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMzgnIHk9JzE0JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMTQnIHk9JzM4JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMzgnIHk9JzM4JyB3aWR0aD0nMTInIGhlaWdodD0nMTInLz48cmVjdCAgeD0nMicgeT0nMzgnIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjxyZWN0ICB4PSc1MCcgeT0nMzgnIHdpZHRoPScxMicgaGVpZ2h0PScxMicvPjwvZz48L3N2Zz4=";

const PATTERN = "https://{canisterId}.raw.icp0.io/{blobType}";

describe("buildIdenticonUrl", () => {
    test("output for a known id is unchanged", () => {
        expect(buildIdenticonUrl("xyz")).toBe(XYZ_IDENTICON);
    });

    test("is deterministic across repeated calls", () => {
        const userId = "27eue-hyaaa-aaaaf-aaa4a-cai";
        const first = buildIdenticonUrl(userId);
        expect(buildIdenticonUrl(userId)).toBe(first);
        expect(buildIdenticonUrl(userId)).toBe(first);
    });

    test("different ids give different identicons", () => {
        expect(buildIdenticonUrl("aaa")).not.toBe(buildIdenticonUrl("bbb"));
    });

    test("the empty id still produces an identicon (no short circuit)", () => {
        expect(buildIdenticonUrl("")).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    test("still correct once the memo has overflowed and evicted", () => {
        // more than the memo's capacity, so the earliest entries get evicted
        for (let i = 0; i < 6000; i++) {
            buildIdenticonUrl(`overflow-${i}`);
        }
        expect(buildIdenticonUrl("xyz")).toBe(XYZ_IDENTICON);
        expect(buildIdenticonUrl("overflow-0")).toBe(buildIdenticonUrl("overflow-0"));
        expect(buildIdenticonUrl("overflow-0")).not.toBe(buildIdenticonUrl("overflow-1"));
    });
});

describe("buildUserAvatarUrl", () => {
    test("a user with a real avatar id gets a blob url, never an identicon", () => {
        expect(buildUserAvatarUrl(PATTERN, "27eue-hyaaa-aaaaf-aaa4a-cai", 123n)).toBe(
            "https://27eue-hyaaa-aaaaf-aaa4a-cai.raw.icp0.io/avatar/123",
        );
    });

    test("the same user gets different urls as their avatar id changes", () => {
        const userId = "27eue-hyaaa-aaaaf-aaa4a-cai";
        expect(buildUserAvatarUrl(PATTERN, userId, 1n)).not.toBe(
            buildUserAvatarUrl(PATTERN, userId, 2n),
        );
        expect(buildUserAvatarUrl(PATTERN, userId, 1n)).not.toBe(
            buildUserAvatarUrl(PATTERN, userId, undefined),
        );
    });

    test("a user with no avatar id gets their identicon", () => {
        expect(buildUserAvatarUrl(PATTERN, "xyz", undefined)).toBe(XYZ_IDENTICON);
    });

    test("the openchat bot gets its fixed avatar, not an identicon", () => {
        expect(buildUserAvatarUrl(PATTERN, OPENCHAT_BOT_USER_ID, undefined)).toBe(
            OPENCHAT_BOT_AVATAR_URL,
        );
    });
});
