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
