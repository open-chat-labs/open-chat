import { describe, expect, test } from "vitest";
import { userMessagePermissionFor } from "./botMessagePermissions";

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
