import { invoke } from "@tauri-apps/api/core";

/**
 * The language chosen in the app (an app/src/i18n code, e.g. "cn"), which the shell's own text
 * follows: notifications, the ring, the share sheet. Rejects on a shell older than the command.
 */
export async function setAppLanguage(language: string): Promise<void> {
    return await invoke<void>("plugin:oc|set_app_language", { language });
}
