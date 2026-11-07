import type { ChatIdentifier } from "@client";

// A message the conversation is asked to go to from another column: the thread panel's "Jump to
// message" (4c) goes to the thread's root in the conversation, whose list the panel can't reach.
// The conversation goes there once and says it's done.

export type MessageJump = { chatId: ChatIdentifier; messageIndex: number };

export class MessageJumps {
    /** The message asked for and not gone to yet. */
    wanted = $state.raw<MessageJump | undefined>();

    /** Asks the conversation to go to the message (again, if it was asked for before). */
    ask(chatId: ChatIdentifier, messageIndex: number): void {
        this.wanted = { chatId, messageIndex };
    }

    /** The conversation has gone to `jump` (a later ask stays wanted). */
    done(jump: MessageJump): void {
        if (this.wanted === jump) this.wanted = undefined;
    }
}
