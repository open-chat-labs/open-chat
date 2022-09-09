import type { ChatEvent, EventWrapper } from "../domain/chat/chat";
import type { Writable } from "svelte/store";
import { immutableStore } from "./immutable";
import { unconfirmed } from "./unconfirmed";

const store: Writable<EventWrapper<ChatEvent>[]> = immutableStore([]);

export const eventsStore = {
    subscribe: store.subscribe,
    update: store.update,
    set: store.set,
    selectChat: (chatId: string): void => store.set(unconfirmed.getMessages(chatId)),
    clear: (): void => store.set([]),
};
