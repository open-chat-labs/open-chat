import type { MessageActionOutcome } from "@src/logic/conversation/messageAction";

// A message's menu (MessageActions) acts on the chat it was opened in. An action awaiting the
// backend may finish after another chat has taken the conversation's place (a notification
// tapped, a link): what it says still shows (a toast), but what it opens over the conversation (a
// sheet, an alert), where it leads (another screen) and the composer's focus after it are the old
// chat's, and are dropped.

/**
 * Counts the chats the conversation has shown, so an action can tell whether the chat it started
 * on still shows.
 */
export class ChatTurns {
    #turn = 0;

    /** Another chat has taken the conversation's place. */
    switched(): void {
        this.#turn++;
    }

    /** An action starts: the check returned is true while the chat it started on still shows. */
    start(): () => boolean {
        const turn = this.#turn;
        return () => turn === this.#turn;
    }
}

/**
 * Whether an action's outcome only says what came of it (a toast, or nothing), which still shows
 * once another chat has taken its place; else it opens something over the conversation or leads
 * away from it, which is dropped then.
 */
export function outlivesChatSwitch(outcome: MessageActionOutcome): boolean {
    switch (outcome.kind) {
        case "ask":
        case "open_chat":
        case "open_thread":
        case "upgrade":
            return false;
        case "done":
        case "succeeded":
        case "failed":
        case "copied":
        case "link_copied":
        case "shared":
        case "deleted":
        case "not_found":
            return true;
    }
}
