import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { getTheme as getWhiteTheme } from "./community/white";
import { derived, readable, writable } from "svelte/store";
import { getTheme as getSubmarineTheme } from "./community/submarine";
import { getTheme as getNightvisionTheme } from "./community/nightvision";
import type { Theme, Themes } from "./types";
import { deepMerge } from "./merge";

const defaultTheme = lightTheme();
const dark = darkTheme(defaultTheme);

// Community themes need to be added here
export const communityThemes = [
    getWhiteTheme(cloneTheme(defaultTheme)),
    getSubmarineTheme(cloneTheme(dark)),
    getNightvisionTheme(cloneTheme(dark)),
];

export const themes: Themes = {
    light: defaultTheme,
    dark,
};

communityThemes.forEach((theme) => {
    themes[theme.name] = theme;
});

export function hexPercent(hex: string, alpha: number | undefined): string {
    const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha !== undefined) {
        return `rgba(${r}, ${g}, ${b}, ${alpha / 100})`;
    } else {
        return `rgb(${r}, ${g}, ${b})`;
    }
}

function cloneTheme(theme: Theme): Theme {
    return JSON.parse(JSON.stringify(theme));
}

function writeCssVars(prefix: string, section: Theme): void {
    for (const [comp, props] of Object.entries(section)) {
        if (typeof props === "string") {
            const varStr = `${prefix}${comp}`;
            document.documentElement.style.setProperty(varStr, props);
        } else if (typeof props === "object" && props) {
            writeCssVars(`${prefix}${comp}-`, props);
        }
    }
}

const prefersDarkQuery = "(prefers-color-scheme: dark)";

const osDarkStore = readable(window.matchMedia(prefersDarkQuery).matches, (set) => {
    const updateDarkPref = (event: MediaQueryListEvent) => set(event.matches);
    const mediaQueryList = window.matchMedia(prefersDarkQuery);
    mediaQueryList.addEventListener("change", updateDarkPref);
    set(mediaQueryList.matches);
    return () => mediaQueryList.removeEventListener("change", updateDarkPref);
});

export const themeNameStore = writable<string>(getCurrentThemeName());

export const themeStore = derived([osDarkStore, themeNameStore], ([$dark, $themeName]) =>
    themeByName($themeName ?? null, $dark)
);

themeStore.subscribe((theme) => writeCssVars("--", theme));

function themeByName(name: string | null, prefersDark: boolean): Theme {
    if (!name || name === "system") {
        return prefersDark ? themes.dark : themes.light;
    }
    return themes[name] ?? themes.light;
}

export function getCurrentThemeName(): string {
    return localStorage.getItem("openchat_theme") ?? "system";
}

export function saveSeletedTheme(themeName: string): void {
    themeNameStore.set(themeName);
    localStorage.setItem("openchat_theme", themeName);
}

export function setModifiedTheme(
    baseName: string,
    newName: string,
    overrides: Partial<Theme>
): void {
    const base = themes[baseName];
    if (base) {
        const overridden = deepMerge(base, overrides);
        themes[newName] = overridden;
        themeNameStore.set(newName);
    }
}
