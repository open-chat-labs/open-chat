import { createSetStore } from "openchat-client";
import { writable } from "svelte/store";

export const claimsStore = createSetStore(writable(new Set<bigint>()));
