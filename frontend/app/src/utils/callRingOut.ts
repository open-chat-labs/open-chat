import type { ChatIdentifier } from "@shared";

// In a direct chat there is no call without the other person. When the caller starts one
// and nobody has joined by the end of the ring window, the caller's own client ends it:
// no server knows who is still ringing. A group or channel call is left alone, as is a
// call this client joined rather than started.

export const RING_OUT_MS = 40_000;

// Pure. Whether a call this client started or joined should ring out.
export function ringOutApplies(chatId: ChatIdentifier, joining: boolean): boolean {
    return chatId.kind === "direct_chat" && !joining;
}

// #9534 invariant 14: a direct call is two people, so when the other one leaves the call is
// over for the one left behind; they hang up, and as the last person present that marks the
// call ended. A group call carries on without whoever left.
export function peerLeftEndsCall(chatId: ChatIdentifier, participantIsLocal: boolean): boolean {
    return chatId.kind === "direct_chat" && !participantIsLocal;
}

export type RingOutHandle = {
    // A remote participant joined, or the call ended: stop the timer.
    cancel: () => void;
};

// Starts the ring-out timer. `answered` is asked at the deadline so a join the caller
// missed the event for still counts.
export function armRingOut(
    answered: () => boolean,
    onNoAnswer: () => void,
    timers: {
        set: (fn: () => void, ms: number) => number;
        clear: (id: number) => void;
    } = { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
): RingOutHandle {
    let live = true;
    const id = timers.set(() => {
        if (!live) return;
        live = false;
        if (!answered()) onNoAnswer();
    }, RING_OUT_MS);
    return {
        cancel: () => {
            if (!live) return;
            live = false;
            timers.clear(id);
        },
    };
}
