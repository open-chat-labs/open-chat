import { locale } from "svelte-i18n";

/**
 * Falls back to English when the initial locale fails to load. svelte-i18n leaves no locale set
 * after a failed load, so every translation would throw (#9636), and it drops the loaders it
 * tried, so they have to be registered again first. Resolves false if English fails too.
 */
export async function withEnglishFallback(
    initialLoad: Promise<void> | void,
    registerLoaders: () => void,
): Promise<boolean> {
    try {
        await initialLoad;
        return true;
    } catch (err) {
        console.error("Locale failed to load, falling back to English", err);
    }
    registerLoaders();
    try {
        await locale.set("en");
        return true;
    } catch (err) {
        console.error("English failed to load", err);
        return false;
    }
}
