import { isAndroidTauriApp } from "@shared";
import { canShareFiles } from "tauri-plugin-oc-api";

// Whether the Android shell can share a message's media (tauri-plugin-oc's shareFiles), which a
// shell older than that can't. Reactive, so a message's offer read before the shell answered
// follows once it does. False until then, and outside Android's shell: browsers and iOS's
// WebView have the Web Share API instead.
let shellSharesFiles = $state(false);

export function canShellShareFiles(): boolean {
    return shellSharesFiles;
}

/** Asks the Android shell whether it can share files. Once, at start (setupNativeApp). */
export async function detectShellFileSharing(): Promise<void> {
    if (!isAndroidTauriApp()) return;
    shellSharesFiles = await canShareFiles().then(
        () => true,
        () => false,
    );
}
