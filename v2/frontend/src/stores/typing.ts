import { writable } from "svelte/store";
import { createSetStore } from "./setStore";

export const typing = createSetStore(writable(new Set<string>()));
