import type { VideoCallContent, VideoCallInProgress } from "@client";

// A call in a chat's timeline: live while it runs, then ended, or missed by someone who never
// joined it, in every tree.

export type CallState = "live" | "ended" | "missed";

/** A call message's state for the user `me`: missed once it's ended without them in it. */
export function callState(
    content: Pick<VideoCallContent, "ended" | "participants">,
    me: string,
): CallState {
    if (content.ended === undefined) return "live";
    return content.participants.some((p) => p.userId === me) ? "ended" : "missed";
}

/** Whether the call is voice only; a video call and a broadcast are video. */
export function callMedia(content: Pick<VideoCallContent, "callType">): "video" | "voice" {
    return content.callType === "audio" ? "voice" : "video";
}

/**
 * How long a call has run (ms): until it ended, or until `now` while it's live. Undefined without
 * the message's time.
 */
export function callLength(
    content: Pick<VideoCallContent, "ended">,
    started: bigint | undefined,
    now: number,
): number | undefined {
    if (started === undefined) return undefined;
    return Math.max(0, Number((content.ended ?? BigInt(now)) - started));
}

/** Whether the chat's live call (`videoCallInProgress`) is the one in this message. */
export function isLiveCall(
    live: Pick<VideoCallInProgress, "messageIndex"> | undefined,
    messageIndex: number,
): boolean {
    return live?.messageIndex === messageIndex;
}

/** CallEvent's props for an ended or missed call. */
export type CallEventProps = {
    state: "ended" | "missed";
    media: "video" | "voice";
    /** "You" is the library's word for the user's own call (no "from …" on a missed one). */
    startedBy: string;
    duration: string;
    time: string;
};

export function callEventProps(
    state: Exclude<CallState, "live">,
    media: "video" | "voice",
    startedBy: { mine: true } | { mine: false; name: string },
    duration: string,
    time: string,
): CallEventProps {
    return {
        state,
        media,
        startedBy: startedBy.mine ? "You" : startedBy.name,
        duration,
        time,
    };
}

/**
 * How a call shows in the web timeline: live only while it's the chat's call in progress
 * (`videoCallInProgress`); a call that never says it ended but isn't in progress any more is over,
 * ended for those in it and missed for the rest, with no length.
 */
export function timelineCallState(
    content: Pick<VideoCallContent, "ended" | "participants">,
    me: string,
    inProgress: boolean,
): CallState {
    if (content.ended === undefined && inProgress) return "live";
    return overCallState(content, me);
}

/** A call that's over: ended for those who were in it, missed for the rest. */
export function overCallState(
    content: Pick<VideoCallContent, "participants">,
    me: string,
): Exclude<CallState, "live"> {
    return content.participants.some((p) => p.userId === me) ? "ended" : "missed";
}

/** Two calls this close together (ms) can go in one group (web/05). */
export const CALL_GROUP_WINDOW_MS = 8 * 60 * 60 * 1000;
const BIGINT_WINDOW = BigInt(CALL_GROUP_WINDOW_MS);

/**
 * The timeline's runs of calls, as web/05 has them: "two or more consecutive calls with no messages
 * between them within 8h collapse into a group; the active call is never grouped". `items` are the
 * list's, newest first; `call` says whether one is a call that's over, and when it was made. A run is
 * calls next to each other in the list (anything else between them, a date's pill too, ends it),
 * each within 8h of the one after it. A run of two or more shows as one item, its newest, which has
 * the run (oldest first) under its key in `runs`; the rest of the run is left out of `items`. With
 * no runs, `items` is the list itself.
 */
export function groupCalls<T extends { key: string }>(
    items: T[],
    call: (item: T) => { timestamp: bigint } | undefined,
): { items: T[]; runs: Map<string, T[]> } {
    const runs = new Map<string, T[]>();
    const shown: T[] = [];
    let i = 0;
    while (i < items.length) {
        const newest = items[i];
        const run = [newest];
        let last = call(newest);
        let j = i + 1;
        while (last !== undefined && j < items.length) {
            const next = call(items[j]);
            if (next === undefined || last.timestamp - next.timestamp > BIGINT_WINDOW) break;
            run.push(items[j]);
            last = next;
            j++;
        }
        shown.push(newest);
        if (run.length > 1) runs.set(newest.key, run.reverse());
        i = j;
    }
    return runs.size === 0 ? { items, runs } : { items: shown, runs };
}
