import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

export const blockedUsers = createSetStore(writable(new Set<string>()));
