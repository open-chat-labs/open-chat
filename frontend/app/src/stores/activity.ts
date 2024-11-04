import { type MessageActivityEvent } from "openchat-shared";
import { writable } from "svelte/store";

export const activityFeedShowing = writable<boolean>(false);

export const activityEvents = writable<MessageActivityEvent[]>([]);
