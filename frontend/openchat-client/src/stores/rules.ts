import type { RulesAcceptanceResolver } from "@shared";
import { writable } from "svelte/store";

export const captureRulesAcceptanceStore = writable<RulesAcceptanceResolver | undefined>(undefined);