import { writable } from "svelte/store";

export type ChatState = {
    chatId: string;
    event: ChatLifecycleEvent;
};

export type ChatLifecycleEvent =
    | "nothing"
    | "loaded_new_messages"
    | "sending_message"
    | "loaded_previous_messages";

const { subscribe, set, update } = writable<ChatState | undefined>(undefined);

export const chatStore = {
    subscribe,
    set,
    clear: (): void =>
        update((val) => (val ? { chatId: val.chatId, event: "nothing" } : undefined)),
};
