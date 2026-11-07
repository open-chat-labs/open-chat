import { invoke } from "@tauri-apps/api/core";

/**
 * Opens the system share sheet for some text, such as a link (the apps' WebViews have no Web Share
 * API). Resolves once the sheet is up. Rejects on a shell older than the command, which the caller
 * treats as no share sheet.
 */
export async function share(text: string, title?: string): Promise<void> {
    return await invoke<void>("plugin:oc|share", { text, title });
}
