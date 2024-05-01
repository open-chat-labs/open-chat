import type { PinNumberResolver, PinNumberSettings } from "openchat-shared";
import { writable } from "svelte/store";

export const pinNumberSettingsStore = writable<PinNumberSettings | undefined>(undefined);

export const capturePinNumberStore = writable<PinNumberResolver | undefined>(undefined);