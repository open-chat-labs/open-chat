import type { ExternalBot } from "openchat-shared";
import { writable } from "svelte/store";

export const externalBots = writable<Map<string, ExternalBot>>(new Map());

export function setExternalBots(bots: ExternalBot[]) {
    const map = new Map<string, ExternalBot>();
    bots.forEach((b) => map.set(b.id, b));
    externalBots.set(map);
}
