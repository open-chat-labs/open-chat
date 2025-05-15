/* eslint-disable no-case-declarations */
import { type ChatIdentifier, type ChatListScope } from "openchat-shared";

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;
