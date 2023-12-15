import { writable } from "svelte/store";
import { mobileOperatingSystem } from "../utils/devices";
import { createMapStore } from "openchat-client";

export const chatListScroll = createMapStore(writable(new Map<string, number>()));

export const eventListScrollTop = writable<number | undefined>(undefined);

export const eventListLastScrolled = writable<number>(0);

export const eventListScrolling = writable<boolean>(false);

export const reverseScroll = mobileOperatingSystem !== "iOS";
