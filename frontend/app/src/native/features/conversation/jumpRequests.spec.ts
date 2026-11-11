import { describe, expect, test, vi } from "vitest";
import { onJumpRequest, requestJump } from "./jumpRequests";

describe("jump requests", () => {
    test("send the conversation for that chat to the message", () => {
        const jump = vi.fn();
        const other = vi.fn();
        const off = onJumpRequest("g1", jump);
        const offOther = onJumpRequest("g2", other);
        expect(requestJump("g1", 42)).toBe(true);
        expect(jump).toHaveBeenCalledExactlyOnceWith(42);
        expect(other).not.toHaveBeenCalled();
        off();
        offOther();
    });

    test("find no one once the conversation has gone", () => {
        const jump = vi.fn();
        onJumpRequest("g1", jump)();
        expect(requestJump("g1", 1)).toBe(false);
        expect(jump).not.toHaveBeenCalled();
    });

    test("keep the latest conversation's when an older one unregisters", () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = onJumpRequest("g1", first);
        const offSecond = onJumpRequest("g1", second);
        offFirst();
        expect(requestJump("g1", 7)).toBe(true);
        expect(second).toHaveBeenCalledExactlyOnceWith(7);
        expect(first).not.toHaveBeenCalled();
        offSecond();
    });
});
