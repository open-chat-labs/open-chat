import type { RulesAcceptanceResolver } from "openchat-shared";
import { writable } from "svelte/store";

export const captureRulesAcceptanceStore = writable<RulesAcceptanceResolver | undefined>(undefined);