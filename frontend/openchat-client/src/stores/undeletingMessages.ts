import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

export const undeletingMessagesStore = createSetStore(writable(new Set<bigint>()));
