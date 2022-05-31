import type { Message } from "domain/chat/chat";
import { writable } from "svelte/store";

export const messageToForwardStore = writable<Message | undefined>(undefined);
