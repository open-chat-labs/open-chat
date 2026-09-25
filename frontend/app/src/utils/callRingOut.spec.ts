import { describe, expect, test, vi } from "vitest";
import { armRingOut, peerLeftEndsCall, RING_OUT_MS, ringOutApplies } from "./callRingOut";

const noRingback = () => undefined;

// A direct call the caller started ends by itself when nobody joins within the ring
// window. Each test names the invariant it pins.

function fakeTimers() {
    const timers = new Map<number, () => void>();
    let next = 1;
    return {
        set: (fn: () => void, _ms: number) => {
            const id = next++;
            timers.set(id, fn);
            return id;
        },
        clear: (id: number) => {
            timers.delete(id);
        },
        fire: () => {
            for (const fn of [...timers.values()]) fn();
            timers.clear();
        },
        pending: () => timers.size,
    };
}

describe("direct call ring-out", () => {
    test("invariant 1 a direct call the caller started ends with no answer at the window", () => {
        const t = fakeTimers();
        const onNoAnswer = vi.fn();
        armRingOut(() => false, onNoAnswer, noRingback, t);
        expect(onNoAnswer).not.toHaveBeenCalled();
        t.fire();
        expect(onNoAnswer).toHaveBeenCalledTimes(1);
    });

    test("invariant 1 the window is 40 seconds", () => {
        const set = vi.fn((_fn: () => void, _ms: number) => 1);
        armRingOut(() => false, vi.fn(), noRingback, { set, clear: vi.fn() });
        expect(set).toHaveBeenCalledWith(expect.any(Function), 40_000);
        expect(RING_OUT_MS).toBe(40_000);
    });

    test("invariant 2 a group or channel call, or a call this client joined, never rings out", () => {
        expect(ringOutApplies({ kind: "direct_chat", userId: "u" }, false)).toBe(true);
        expect(ringOutApplies({ kind: "direct_chat", userId: "u" }, true)).toBe(false);
        expect(ringOutApplies({ kind: "group_chat", groupId: "g" }, false)).toBe(false);
        expect(ringOutApplies({ kind: "channel", communityId: "c", channelId: 1 }, false)).toBe(
            false,
        );
    });

    test("invariant 3 a join within the window cancels the ring-out", () => {
        const t = fakeTimers();
        const onNoAnswer = vi.fn();
        const handle = armRingOut(() => false, onNoAnswer, noRingback, t);
        handle.cancel();
        expect(t.pending()).toBe(0);
        t.fire();
        expect(onNoAnswer).not.toHaveBeenCalled();
    });

    test("invariant 3 a join the client missed the event for still counts at the deadline", () => {
        const t = fakeTimers();
        const onNoAnswer = vi.fn();
        let joined = false;
        armRingOut(() => joined, onNoAnswer, noRingback, t);
        joined = true;
        t.fire();
        expect(onNoAnswer).not.toHaveBeenCalled();
    });

    test("cancelling after the deadline fired is harmless and it fires only once", () => {
        const t = fakeTimers();
        const onNoAnswer = vi.fn();
        const handle = armRingOut(() => false, onNoAnswer, noRingback, t);
        t.fire();
        t.fire();
        handle.cancel();
        expect(onNoAnswer).toHaveBeenCalledTimes(1);
    });
});

describe("peerLeftEndsCall (#9534 invariant 14)", () => {
    const direct = { kind: "direct_chat", userId: "u" } as const;
    const group = { kind: "group_chat", groupId: "g" } as const;
    test("invariant 14 the other party leaving a direct call ends it for the one left behind", () => {
        expect(peerLeftEndsCall(direct, false)).toBe(true);
    });
    test("invariant 14 my own leave and any leave from a group call end nothing here", () => {
        expect(peerLeftEndsCall(direct, true)).toBe(false);
        expect(peerLeftEndsCall(group, false)).toBe(false);
        expect(peerLeftEndsCall(group, true)).toBe(false);
    });
});

describe("ringback (#9559 invariant 14)", () => {
    function fakeTimers() {
        let fire: (() => void) | undefined;
        return {
            t: { set: (fn: () => void) => ((fire = fn), 1), clear: vi.fn() },
            fire: () => fire?.(),
        };
    }
    test("invariant 14 ringback is on from arming until a join cancels the ring-out", () => {
        const ringback = vi.fn();
        const { t } = fakeTimers();
        const handle = armRingOut(() => false, vi.fn(), ringback, t);
        expect(ringback.mock.calls).toEqual([[true]]);
        handle.cancel();
        expect(ringback.mock.calls).toEqual([[true], [false]]);
        // a second cancel changes nothing
        handle.cancel();
        expect(ringback.mock.calls).toEqual([[true], [false]]);
    });
    test("invariant 14 ringback stops when the window elapses, answered or not", () => {
        const ringback = vi.fn();
        const { t, fire } = fakeTimers();
        armRingOut(() => false, vi.fn(), ringback, t);
        fire();
        expect(ringback.mock.calls).toEqual([[true], [false]]);
        const answeredRingback = vi.fn();
        const late = fakeTimers();
        armRingOut(() => true, vi.fn(), answeredRingback, late.t);
        late.fire();
        expect(answeredRingback.mock.calls).toEqual([[true], [false]]);
    });
});
