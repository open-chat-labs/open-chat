import type { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";
import { describe, expect, test, vi } from "vitest";
import { conversationPins, onJumpRequest, requestJump } from "./jumpRequests";

const pins = {} as PinnedMessages;

describe("jump requests", () => {
    test("send the conversation for that chat to the message", () => {
        const jump = vi.fn();
        const other = vi.fn();
        const off = onJumpRequest("g1", { jump, pinned: pins });
        const offOther = onJumpRequest("g2", { jump: other, pinned: pins });
        expect(requestJump("g1", 42)).toBe(true);
        expect(jump).toHaveBeenCalledExactlyOnceWith(42);
        expect(other).not.toHaveBeenCalled();
        off();
        offOther();
    });

    test("find no one once the conversation has gone", () => {
        const jump = vi.fn();
        onJumpRequest("g1", { jump, pinned: pins })();
        expect(requestJump("g1", 1)).toBe(false);
        expect(jump).not.toHaveBeenCalled();
        expect(conversationPins("g1")).toBeUndefined();
    });

    test("keep the latest conversation's when an older one unregisters", () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = onJumpRequest("g1", { jump: first, pinned: pins });
        const offSecond = onJumpRequest("g1", { jump: second, pinned: pins });
        offFirst();
        expect(requestJump("g1", 7)).toBe(true);
        expect(second).toHaveBeenCalledExactlyOnceWith(7);
        expect(first).not.toHaveBeenCalled();
        offSecond();
    });
});

describe("the conversation's pinned messages", () => {
    test("are the ones the conversation for that chat holds", () => {
        const mine = {} as PinnedMessages;
        const off = onJumpRequest("g1", { jump: vi.fn(), pinned: mine });
        expect(conversationPins("g1")).toBe(mine);
        expect(conversationPins("g2")).toBeUndefined();
        off();
    });
});
