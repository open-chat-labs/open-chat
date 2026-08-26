import { invoke } from "@tauri-apps/api/core";

export type ExportMediaResponse = {
    filePath: string;
};

// iOS only: photo-library assets carry no readable file path, so the item
// picked from the recent-media strip (identified by the `uri` returned from
// loadRecentMedia) is exported to a temp file the webview can read via the
// asset protocol. On Android the file path from loadRecentMedia is used
// directly and this command is never called.
export async function exportMedia(uri: string): Promise<string> {
    return await invoke<ExportMediaResponse>("plugin:oc|export_media", {
        payload: { uri },
    }).then((r) => r.filePath);
}
