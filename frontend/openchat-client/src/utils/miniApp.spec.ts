import { describe, expect, test } from "vitest";
import { miniAppButtonFailureMessage, userMessagePermissionFor } from "./miniApp";

describe("miniAppButtonFailureMessage", () => {
    test("every failure has a message, and the bot's own text isn't shown", () => {
        expect(miniAppButtonFailureMessage({ kind: "not_authorized" }).key).toBe(
            "bots.miniApp.notAuthorized",
        );
        expect(miniAppButtonFailureMessage({ kind: "too_many_requests" }).key).toBe(
            "bots.miniApp.tooManyRequests",
        );
        expect(
            miniAppButtonFailureMessage({ kind: "bad_request", reason: "Not your turn" }).key,
        ).toBe("bots.miniApp.failed");
        expect(miniAppButtonFailureMessage({ kind: "internal_error", error: "boom" }).key).toBe(
            "bots.miniApp.failed",
        );
    });
});

describe("userMessagePermissionFor", () => {
    test("a bot posting a mini app for someone needs them to be able to post text", () => {
        expect(userMessagePermissionFor("miniApp")).toBe("text");
    });

    test("members have no message permission for video calls", () => {
        expect(userMessagePermissionFor("videoCall")).toBeUndefined();
    });

    test("other permissions are the member's own of the same name", () => {
        expect(userMessagePermissionFor("image")).toBe("image");
        expect(userMessagePermissionFor("p2pSwap")).toBe("p2pSwap");
    });
});
