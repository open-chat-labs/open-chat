import { invoke } from "@tauri-apps/api/core";

export type LoadRecentMediaRequest = {
    count: number;
    offset: number;
};

export type MediaPermissionStatus = "granted" | "denied" | "prompt";

export type RecentMedia = {
    uri: string;
    filename: string;
    mimeType: string;
    dateAdded: number;
    isVideo: boolean;
    filePath: string;
    thumbnail?: string;
};

export type RecentMediaResponse = {
    permission: MediaPermissionStatus;
    media: RecentMedia[];
};

export async function loadRecentMedia(
    payload?: LoadRecentMediaRequest,
): Promise<RecentMediaResponse> {
    return await invoke<RecentMediaResponse>("plugin:oc|load_recent_media", {
        payload: payload ?? {},
    });
}
