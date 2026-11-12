import type { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";

// What a screen over the conversation (the Pinned messages screen) uses of the conversation under
// it, which registers it while it's mounted, by its chat (`chatIdentifierToString`), as for its
// search (searchRequests):
// - going to a message (native plan 04: "Tap a bubble → back to the chat, jump to that message and
//   highlight it"): the conversation owns its list, so it goes to the message and marks it;
// - its pinned messages, loaded and kept in step with the pins (and marked read) for its strip, so
//   the screen shows the same ones without fetching them again.

/** The conversation for a chat, as the screens over it use it. */
export type ConversationHandle = {
    jump: (messageIndex: number) => void;
    pinned: PinnedMessages;
};

const conversations = new Map<string, ConversationHandle>();

/** Registers the conversation for `chatKey`. Returns the call that unregisters it. */
export function onJumpRequest(chatKey: string, handle: ConversationHandle): () => void {
    conversations.set(chatKey, handle);
    return () => {
        // a conversation for the same chat mounted since keeps its own
        if (conversations.get(chatKey) === handle) conversations.delete(chatKey);
    };
}

/** Sends the conversation for `chatKey` to the message; whether one was there to go. */
export function requestJump(chatKey: string, messageIndex: number): boolean {
    const handle = conversations.get(chatKey);
    handle?.jump(messageIndex);
    return handle !== undefined;
}

/** The pinned messages the conversation for `chatKey` holds, if it's there. */
export function conversationPins(chatKey: string): PinnedMessages | undefined {
    return conversations.get(chatKey)?.pinned;
}
