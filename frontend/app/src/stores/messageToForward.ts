import type { Message } from "@client";
import { writable } from "svelte/store";

export const messageToForwardStore = writable<Message | undefined>(undefined);
