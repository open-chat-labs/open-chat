import { createSetStore } from "./setStore";
import { writable } from "svelte/store";

export const recommendedGroupExclusions = createSetStore<string>(writable(new Set<string>()));
