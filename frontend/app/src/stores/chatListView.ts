import { writable } from "svelte/store";

export const chatListView = writable<"chats" | "threads">("chats");
