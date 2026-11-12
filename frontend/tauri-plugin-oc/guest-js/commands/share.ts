import { invoke } from "@tauri-apps/api/core";

/**
 * Opens the system share sheet for some text, such as a link (the apps' WebViews have no Web Share
 * API). Resolves once the sheet is up. Rejects on a shell older than the command, which the caller
 * treats as no share sheet.
 */
export async function share(text: string, title?: string): Promise<void> {
    return await invoke<void>("plugin:oc|share", { text, title });
}

/**
 * Resolves on an Android shell that can share files (shareFiles), and rejects on one older than
 * that, which the caller treats as no sharing files.
 */
export async function canShareFiles(): Promise<void> {
    return await invoke<void>("plugin:oc|can_share_files");
}

// What a call to stage_share_file carries: half a MiB, which keeps each call's base64 small
const STAGE_CHUNK_BYTES = 512 * 1024;

/**
 * Opens the Android share sheet for some files, with some text: each file is staged in the app's
 * cache, a chunk at a time, and handed over from there. Only for a shell canShareFiles resolved on.
 */
export async function shareFiles(files: File[], text?: string, title?: string): Promise<void> {
    const staged = [];
    for (const file of files) {
        staged.push({ file: await stageFile(file), mimeType: file.type || undefined });
    }
    return await invoke<void>("plugin:oc|share", { text, title, files: staged });
}

async function stageFile(file: File): Promise<string> {
    let staged: string | undefined;
    let offset = 0;
    do {
        const data = await base64(file.slice(offset, offset + STAGE_CHUNK_BYTES));
        const res = await invoke<{ file: string }>("plugin:oc|stage_share_file", {
            file: staged,
            name: file.name,
            data,
        });
        staged = res.file;
        offset += STAGE_CHUNK_BYTES;
    } while (offset < file.size);
    return staged;
}

function base64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // a data URL: "data:<type>;base64,<data>"
        reader.onload = () => resolve((reader.result as string).split(",", 2)[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
