import { openUrl } from "tauri-plugin-oc-api";

/**
 * A page of the website the native app has no screen for (the marketing pages: Landing, Learn,
 * the terms and privacy policy …), opened in the default browser, as the old native app's About
 * does and as a deep link to one is.
 */
export function openOnWeb(path: string, origin: string): void {
    openUrl({ url: new URL(path, origin).toString() }).catch((e) =>
        console.error("Couldn't open the page in the browser", e),
    );
}
