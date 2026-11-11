// A message asked for from a screen over the conversation (the Pinned messages screen, native
// plan 04: "Tap a bubble → back to the chat, jump to that message and highlight it"): it goes back
// to the conversation under it, which goes to the message and marks it. The conversation owns its
// list, so it registers how to go to a message while it's mounted, by its chat
// (`chatIdentifierToString`), as for its search (searchRequests).

const jumpers = new Map<string, (messageIndex: number) => void>();

/** Registers how the conversation for `chatKey` goes to a message. Returns the call that unregisters it. */
export function onJumpRequest(chatKey: string, jump: (messageIndex: number) => void): () => void {
    jumpers.set(chatKey, jump);
    return () => {
        // a conversation for the same chat mounted since keeps its own
        if (jumpers.get(chatKey) === jump) jumpers.delete(chatKey);
    };
}

/** Sends the conversation for `chatKey` to the message; whether one was there to go. */
export function requestJump(chatKey: string, messageIndex: number): boolean {
    const jump = jumpers.get(chatKey);
    jump?.(messageIndex);
    return jump !== undefined;
}
