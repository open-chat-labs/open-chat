import type { PinNumberResolver } from "openchat-shared";
import { writable } from "svelte/store";

export const pinNumberRequiredStore = writable<boolean>(undefined);

export const capturePinNumberStore = writable<PinNumberResolver | undefined>(undefined);