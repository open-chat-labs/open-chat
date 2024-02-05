import { writable } from "svelte/store";
import { mobileOperatingSystem } from "../utils/devices";

export const eventListScrollTop = writable<number | undefined>(undefined);

export const eventListLastScrolled = writable<number>(0);

export const eventListScrolling = writable<boolean>(false);

export const communityListScrollTop = writable<number | undefined>(undefined);

export const reverseScroll = mobileOperatingSystem !== "iOS";
