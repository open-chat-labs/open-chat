import { invoke } from "@tauri-apps/api/core";

export type ChatShortcut = {
    id: string;
    name: string;
    avatarUrl?: string;
};

export type UpdateChatShortcutsRequest = {
    chats: ChatShortcut[];
};

export type UpdateChatShortcutsResponse = {
    count: number;
};

export async function updateChatShortcuts(
    payload: UpdateChatShortcutsRequest,
): Promise<UpdateChatShortcutsResponse> {
    return await invoke<UpdateChatShortcutsResponse>("plugin:oc|update_chat_shortcuts", {
        payload,
    });
}
