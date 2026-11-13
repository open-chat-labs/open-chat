import { languageCode, supportedLanguagesByCode } from "@i18n/i18n";
import { locale } from "svelte-i18n";
import { setAppLanguage } from "tauri-plugin-oc-api";

/**
 * Tells the shell the app's language now and on every change. The shell's own text
 * (notifications, the ring, the share sheet) is part of OpenChat's UI, so it follows the language
 * the app shows, not the phone's: English when the app has no translations for the locale. A shell
 * older than set_app_language rejects, and keeps the phone's language. Returns the teardown.
 */
export function followLanguageInShell(): () => void {
    let sent: string | undefined;
    return locale.subscribe((current) => {
        if (!current) return;
        const code = languageCode(current);
        const language = supportedLanguagesByCode[code] !== undefined ? code : "en";
        if (language === sent) return;
        sent = language;
        setAppLanguage(language).catch(() => {});
    });
}
