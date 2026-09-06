import {
    applyTheme,
    builtinThemes,
    getBuiltinThemeNames,
    type ThemeAppearance,
    type ThemeMode,
} from "component-lib";
import { derived, readable } from "svelte/store";
import { createLocalStorageStore } from "../utils/store";

// Preferences for the mobile (v2) layout's theme system. The base family name
// (e.g. "neon") is stored separately from the appearance so that switching
// between dark / light / system preserves the chosen family.
export const themeV2Appearance = createLocalStorageStore("openchat_v2_appearance", "dark");
export const themeV2Family = createLocalStorageStore("openchat_v2_theme", "neon");

const prefersDarkQuery = "(prefers-color-scheme: dark)";

const osDark = readable(window.matchMedia(prefersDarkQuery).matches, (set) => {
    const mediaQueryList = window.matchMedia(prefersDarkQuery);
    const update = (event: MediaQueryListEvent) => set(event.matches);
    mediaQueryList.addEventListener("change", update);
    set(mediaQueryList.matches);
    return () => mediaQueryList.removeEventListener("change", update);
});

function resolveThemeId(family: string, appearance: string, osIsDark: boolean): string {
    const mode: ThemeMode =
        appearance === "system" ? (osIsDark ? "dark" : "light") : (appearance as ThemeMode);
    const id = mode === "dark" ? family : `${family}-light`;
    return id in builtinThemes ? id : "neon";
}

export const activeThemeV2Id = derived(
    [themeV2Family, themeV2Appearance, osDark],
    ([family, appearance, osIsDark]) => resolveThemeId(family, appearance, osIsDark),
);

export function initThemeV2(): void {
    activeThemeV2Id.subscribe((id) => applyTheme(id));
}

export function setThemeV2Appearance(appearance: ThemeAppearance): void {
    themeV2Appearance.set(appearance);
}

export function setPreferredThemeV2(family: string): void {
    themeV2Family.set(family);
}

export function getThemeV2Families(): string[] {
    return getBuiltinThemeNames("dark");
}
