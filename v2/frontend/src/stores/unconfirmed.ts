import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

export const unconfirmed = createSetStore(writable(new Set<bigint>()));
export const unconfirmedReadByThem = createSetStore(writable(new Set<bigint>()));
