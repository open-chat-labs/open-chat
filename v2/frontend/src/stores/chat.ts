import { writable } from "svelte/store";

export type ChatState = {
    chatId: string;
    event: ChatLifecycleEvent;
};

export type ChatLifecycleEvent =
    | Nothing
    | LoadedNewMessages
    | SendingMessage
    | ChatUpdated
    | LoadedPreviousMessages;

type Nothing = { kind: "nothing" };
type LoadedNewMessages = { kind: "loaded_new_messages" };
type SendingMessage = {
    kind: "sending_message";
    messageIndex: number;
    sentByMe: boolean;
    scroll: ScrollBehavior;
};
type ChatUpdated = { kind: "chat_updated" };
type LoadedPreviousMessages = { kind: "loaded_previous_messages" };

const { subscribe, set, update } = writable<ChatState | undefined>(undefined);

export const chatStore = {
    subscribe,
    set,
    clear: (): void =>
        update((val) => (val ? { chatId: val.chatId, event: { kind: "nothing" } } : undefined)),
};
