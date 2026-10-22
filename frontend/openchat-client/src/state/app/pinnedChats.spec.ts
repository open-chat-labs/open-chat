import type { ChatIdentifier } from "@shared";
import { localUpdates } from "../localUpdates";
import { pinnedChatsStore, serverPinnedChatsStore } from "./stores";

const serverPinned: ChatIdentifier = { kind: "group_chat", groupId: "server-pinned" };
const chatId: ChatIdentifier = { kind: "group_chat", groupId: "to-pin" };

describe("pinned chats local updates", () => {
    let unsub: () => void;

    beforeEach(() => {
        localUpdates.clearAll();
        serverPinnedChatsStore.set(new Map([["chats", [serverPinned]]]));
        unsub = pinnedChatsStore.subscribe(() => {});
    });

    afterEach(() => unsub());

    test("invariant: undoing a failed pin removes the chat from the pinned list", () => {
        const undo = localUpdates.pinToScope(chatId, "chats");
        expect(pinnedChatsStore.value.get("chats")).toEqual([chatId, serverPinned]);

        undo();

        expect(pinnedChatsStore.value.get("chats")).toEqual([serverPinned]);
        expect(serverPinnedChatsStore.value.get("chats")).toEqual([serverPinned]);
    });
});
