import type { Writable } from "svelte/store";
import { immutableStore } from "./immutable";

export const focusMessageIndexStore: Writable<number | undefined> = immutableStore(undefined);
