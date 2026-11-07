import { describe, expect, test } from "vitest";
import { directChatStatus } from "./chatStatus";

describe("what a DM's header says about the other person", () => {
    test("a suspended account says so, a bot nothing, anyone else when they were last online", () => {
        expect(directChatStatus({ kind: "user", suspended: true })).toBe("suspended");
        expect(directChatStatus({ kind: "bot", suspended: false })).toBe("bot");
        expect(directChatStatus({ kind: "user", suspended: false })).toBe("last_online");
        // someone not loaded yet
        expect(directChatStatus(undefined)).toBe("last_online");
    });
});
