import { MessageContextMap, type UnconfirmedState } from "openchat-shared";
import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

export type UnconfirmedMessages = MessageContextMap<UnconfirmedState>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedReadByThemStore() {
    return createSetStore(writable(new Set<bigint>()));
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();
