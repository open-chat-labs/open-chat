import { describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as never) as typeof window.matchMedia;
});

import { OpenChat } from "./openchat";
import type { BlockContext } from "./utils/profileBlock";

const contexts: BlockContext[] = [
    { kind: "direct_chat" },
    { kind: "group_chat", id: { kind: "group_chat", groupId: "g" } },
    { kind: "community", id: { kind: "community", communityId: "c" } },
];

// the methods each context's block and unblock go through, on a stand-in for the client
function standIn() {
    const methods = {
        blockUserFromDirectChat: vi.fn(async () => true),
        unblockUserFromDirectChat: vi.fn(async () => true),
        blockUser: vi.fn(async () => true),
        unblockUser: vi.fn(async () => true),
        blockCommunityUser: vi.fn(async () => true),
        unblockCommunityUser: vi.fn(async () => true),
    };
    return methods;
}

const expected: Record<BlockContext["kind"], { block: string; unblock: string }> = {
    direct_chat: { block: "blockUserFromDirectChat", unblock: "unblockUserFromDirectChat" },
    group_chat: { block: "blockUser", unblock: "unblockUser" },
    community: { block: "blockCommunityUser", unblock: "unblockCommunityUser" },
};

describe("blocking in context", () => {
    // 4a invariant 1: blocking from a profile blocks (and unblocking unblocks) in its context
    test("block and unblock each call only their own context's matching method", async () => {
        for (const context of contexts) {
            for (const op of ["block", "unblock"] as const) {
                const client = standIn();
                const run =
                    op === "block"
                        ? OpenChat.prototype.blockUserInContext
                        : OpenChat.prototype.unblockUserInContext;
                await run.call(client as never, context, "u");
                const called = Object.entries(client)
                    .filter(([, fn]) => fn.mock.calls.length > 0)
                    .map(([name]) => name);
                expect(called, `${op} in ${context.kind}`).toEqual([expected[context.kind][op]]);
            }
        }
    });
});
