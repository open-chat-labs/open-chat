import { MessageContextMap, type UnconfirmedState } from "openchat-shared";
import { createSetStore } from "./setStore";

export type UnconfirmedMessages = MessageContextMap<UnconfirmedState>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function createUnconfirmedReadByThemStore() {
    return createSetStore<bigint>();
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();
