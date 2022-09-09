import type { Member } from "../domain/chat/chat";
import type { Writable } from "svelte/store";
import { immutableStore } from "./immutable";

export const currentChatMembers: Writable<Member[]> = immutableStore([]);
