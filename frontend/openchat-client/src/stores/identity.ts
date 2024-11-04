import type { IdentityState } from "openchat-shared";
import { writable } from "svelte/store";

export const identityState = writable<IdentityState>({ kind: "loading_user" });
