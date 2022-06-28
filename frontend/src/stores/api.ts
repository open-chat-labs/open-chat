import type { ServiceContainer } from "../services/serviceContainer";
import { writable } from "svelte/store";

export const apiStore = writable<ServiceContainer | undefined>();
