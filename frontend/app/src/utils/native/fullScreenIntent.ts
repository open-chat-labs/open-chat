import { invoke } from "@tauri-apps/api/core";

// Android 14 grants USE_FULL_SCREEN_INTENT by default only to calling and alarm apps. Without it
// a call to a locked phone rings as a heads-up notification instead of over the lock screen, and
// nothing says why (#9454, user story 53). The grant is a settings toggle with no runtime prompt,
// so the app explains it and links to the toggle.

let checkedThisLaunch = false;

/**
 * Whether to ask the user for the full-screen ring now: on Android only, at most once per app
 * launch, and only when the shell says the grant is missing. A shell older than
 * can_use_full_screen_intent rejects, and that means don't ask.
 */
export async function shouldAskForFullScreenIntent(android: boolean): Promise<boolean> {
    if (!android || checkedThisLaunch) return false;
    checkedThisLaunch = true;
    try {
        const { granted } = await invoke<{ granted?: boolean }>(
            "plugin:oc|can_use_full_screen_intent",
        );
        return granted === false;
    } catch {
        return false;
    }
}

/** Opens the system page where the user grants the full-screen ring. */
export async function openFullScreenIntentSettings(): Promise<void> {
    try {
        await invoke("plugin:oc|open_full_screen_intent_settings");
    } catch (err) {
        console.warn("Couldn't open the full-screen intent settings", err);
    }
}
