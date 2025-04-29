/* eslint-disable no-case-declarations */
import {
    ChatMap,
    chatScopesEqual,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
} from "openchat-shared";
import { derived } from "svelte/store";
import { app } from "../state/app.svelte";
import { createDummyStore } from "./dummyStore";
import { safeWritable } from "./safeWritable";

// These dummy stores only exist to help us keep things in sync while we migrate stuff
export const dummyServerCommunities = createDummyStore();
export const dummyServerDirectChats = createDummyStore();
export const dummyServerGroupChats = createDummyStore();
export const dummyServerFavourites = createDummyStore();

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;

// This should always be referenced via app.chatListScope where possible - this store only exists for backward compatibility and will be removed
export const chatListScopeStore = safeWritable<ChatListScope>({ kind: "none" }, chatScopesEqual);

export function getAllServerChats(): ChatMap<ChatSummary> {
    const groupChats = app.serverGroupChats.values();
    const directChats = app.serverDirectChats.values();
    const channels = [...app.serverCommunities.values()].flatMap((c) => c.channels);
    return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
}

export const allServerChats = derived(
    [dummyServerGroupChats, dummyServerDirectChats, dummyServerCommunities],
    () => {
        return getAllServerChats();
    },
);
