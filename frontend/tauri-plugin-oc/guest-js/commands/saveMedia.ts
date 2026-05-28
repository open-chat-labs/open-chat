import { invoke } from "@tauri-apps/api/core";

export type SaveMediaRequest = {
    kind: string;
    filename: string;
    data: Uint8Array;
    mimeType: string;
};

export async function saveMediaToDevice(payload: SaveMediaRequest): Promise<void> {
    return invoke<void>("plugin:oc|save_media", { payload });
}
