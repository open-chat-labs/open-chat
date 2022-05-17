import type { Alert } from "../domain/chat/chat";
import { writable } from "svelte/store";

export const alertsStore = writable<Alert[]>([]);
