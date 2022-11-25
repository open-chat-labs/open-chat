/**
 * This is a *super* simple (borderline naive) mechanism to connect threads with the main chat
 * in a vaguely decoupled way. This is needed when operations are performed on the root message
 * when they need to be handled in the main chat
 */

import type { Message } from "openchat-client";

export type RelayedEvent =
    | RelayedDeleteMessage
    | RelayedUndeleteMessage
    | RelayedSelectReaction
    | RelayedRegisterVote
    | RelayedGoToMessage;

export type RelayedDeleteMessage = {
    kind: "relayed_delete_message";
    message: Message;
};

export type RelayedUndeleteMessage = {
    kind: "relayed_undelete_message";
    message: Message;
};

export type RelayedGoToMessage = {
    kind: "relayed_goto_message";
    index: number;
    messageId: bigint;
};

export type RelayedRegisterVote = {
    kind: "relayed_register_vote";
    data: {
        messageIndex: number;
        messageId: bigint;
        answerIndex: number;
        type: "register" | "delete";
    };
};

export type RelayedSelectReaction = {
    kind: "relayed_select_reaction";
    message: Message;
    reaction: string;
};

export type CallbackFn = (event: RelayedEvent) => void;

let callback: CallbackFn | undefined;

export function relaySubscribe(fn: CallbackFn): void {
    callback = fn;
}

export function relayUnsubscribe(): void {
    callback = undefined;
}

export function relayPublish(event: RelayedEvent): void {
    if (callback !== undefined) {
        callback(event);
    }
}
