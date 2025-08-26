import { writable } from "svelte/store";
import type { MinutesOnline } from "openchat-shared";

export const minutesOnlineStore = writable<MinutesOnline>({
    minutesOnlineThisMonth: 0,
    minutesOnlineLastMonth: 0
});