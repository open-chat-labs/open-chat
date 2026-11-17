import type { ChatIdentifier, VideoCallType } from "@client";

/** A call ringing here: the chat it's in and the type it was started as. */
export type RingingCall = { chatId: ChatIdentifier; callType: VideoCallType };

/** What answering a ring does, in each tree's own way. */
export interface RingHandlers {
    /** Stops ringing here. The call keeps ringing on the user's other devices. */
    clear(): void;
    /** Declines the call: a direct call ends for the caller too. */
    decline(chatId: ChatIdentifier): void;
    /** Opens the call's chat. */
    open(chatId: ChatIdentifier): void;
    /** Joins the call. */
    join(request: { chatId: ChatIdentifier; callType: VideoCallType; join: true }): void;
}

/**
 * The incoming call card's three ways out. Accept opens the chat and joins the call as the type it
 * was started as. Decline declines it. Dismiss (the card's ✕, Esc, or the card going away) only
 * stops the ring here, and never declines: the user may answer on another device.
 */
export function ringActions(call: RingingCall, handlers: RingHandlers) {
    return {
        accept() {
            handlers.clear();
            handlers.open(call.chatId);
            handlers.join({ chatId: call.chatId, callType: call.callType, join: true });
        },
        decline() {
            handlers.clear();
            handlers.decline(call.chatId);
        },
        dismiss() {
            handlers.clear();
        },
    };
}
