import { MessageContextMap, type UnconfirmedState } from "openchat-shared";
import { createSetStore } from "./setStore";

export type UnconfirmedMessages = MessageContextMap<UnconfirmedState>;

 
function createUnconfirmedReadByThemStore() {
    return createSetStore<bigint>();
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();
