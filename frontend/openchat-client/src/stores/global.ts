/* eslint-disable no-case-declarations */
import { chatScopesEqual, type ChatIdentifier, type ChatListScope } from "openchat-shared";
import { safeWritable } from "./safeWritable";

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;

// This should always be referenced via app.chatListScope where possible - this store only exists for backward compatibility and will be removed
export const chatListScopeStore = safeWritable<ChatListScope>({ kind: "none" }, chatScopesEqual);
