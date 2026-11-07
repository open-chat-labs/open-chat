import { onBackButtonPress } from "@tauri-apps/api/app";
import type { PluginListener } from "@tauri-apps/api/core";
import { expectBackPress } from "@utils/native/notification_channels";

// Android's system back, as it reaches the native tree. Two callbacks on the activity's back
// dispatcher can take the press, and the last one added wins:
//
// - Tauri's own (its `app` plugin's): with nothing listening for its `back-button` event, it takes
//   the WebView back through its history when it can, and only passes the press on when it can't.
//   That history isn't the stacks': a screen pushed without a URL (a settings page, New chat) has
//   no entry of its own, so the WebView went back to the URL before it, often another tab. With a
//   listener, it sends the event and does nothing else.
// - MainActivity's, which sends tauri-plugin-oc's `back-pressed` and nothing else.
//
// Which of the two comes last depends on when the plugins load, so the shell listens to both:
// whichever takes the press sends one event, never both.

/** Listens for Android's system back; returns what stops listening. */
export async function listenForSystemBack(handler: () => void): Promise<() => void> {
    const settled = await Promise.allSettled([
        onBackButtonPress(() => handler()),
        expectBackPress(handler),
    ]);
    const listeners: PluginListener[] = [];
    for (const result of settled) {
        if (result.status === "fulfilled") listeners.push(result.value);
        else console.error("Couldn't listen for the system back", result.reason);
    }
    return () => {
        for (const listener of listeners) void listener.unregister();
    };
}
