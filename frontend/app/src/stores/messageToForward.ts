import type { Message } from "openchat-client";
import { writable } from "svelte/store";

export const messageToForwardStore = writable<Message | undefined>(undefined);
