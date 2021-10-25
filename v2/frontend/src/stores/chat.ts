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
    | ScrollToMessageIndex
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
type ScrollToMessageIndex = { kind: "scroll_to_message_index"; messageIndex: number };

const { subscribe, set, update } = writable<ChatState | undefined>(undefined);

export const chatStore = {
    subscribe,
    set,
    clear: (): void =>
        update((val) => (val ? { chatId: val.chatId, event: { kind: "nothing" } } : undefined)),
};
