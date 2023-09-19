import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { getTheme as getWhiteTheme } from "./community/white";
import { derived, readable, writable } from "svelte/store";
import { getTheme as getSubmarineTheme } from "./community/submarine";
import { getTheme as getNightvisionTheme } from "./community/nightvision";
import { getTheme as getMatteBlackGoldTheme } from "./community/matteblackgold";
import { getTheme as getBarbieTheme } from "./community/barbie";
import { getTheme as getTokyoNightTheme } from "./community/tokyonight";
import { getTheme as getSolarizedDarkTheme } from "./community/solarizeddark";
import type { Theme, Themes } from "./types";
import { deepMerge } from "./merge";

const defaultTheme = lightTheme();
const dark = darkTheme(defaultTheme);

// Community themes need to be added here
export const communityThemes = [
    getWhiteTheme(cloneTheme(defaultTheme)),
    getSubmarineTheme(cloneTheme(dark)),
    getNightvisionTheme(cloneTheme(dark)),
    getMatteBlackGoldTheme(cloneTheme(dark)),
    getBarbieTheme(cloneTheme(defaultTheme)),
    getTokyoNightTheme(cloneTheme(dark)),
    getSolarizedDarkTheme(cloneTheme(dark)),
];

export const themes: Themes = {
    light: defaultTheme,
    dark,
};

communityThemes.forEach((theme) => {
    themes[theme.name] = theme;
});

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

export function setModifiedTheme(
    baseName: string,
    newName: string,
    overrides: Partial<Theme>,
): void {
    const base = themes[baseName];
    if (base) {
        const overridden = deepMerge(base, overrides);
        themes[newName] = overridden;
        themeOverride.set(newName);
    }
}

const themeOverride = writable<string>(undefined);
export const themeType = createLocalStorageStore("openchat_theme", "system");
export const preferredDarkThemeName = createLocalStorageStore("openchat_dark_theme", "dark");
export const preferredLightThemeName = createLocalStorageStore("openchat_light_theme", "light");

export const preferredDarkTheme = derived(preferredDarkThemeName, (darkName) => themes[darkName]);
export const preferredLightTheme = derived(
    preferredLightThemeName,
    (lightName) => themes[lightName],
);

export const currentThemeName = derived(
    [themeType, preferredDarkThemeName, preferredLightThemeName, osDarkStore, themeOverride],
    ([$themeType, preferredDark, preferredLight, prefersDark, override]) => {
        if (override !== undefined) return override;

        let themeName = "light";
        if ($themeType === "system") {
            if (prefersDark) {
                themeName = preferredDark;
            } else {
                themeName = preferredLight;
            }
        } else if ($themeType === "light") {
            themeName = preferredLight;
        } else if ($themeType === "dark") {
            themeName = preferredDark;
        } else {
            // this branch exists to deal with legacy states where a user has selected a particular community theme
            const existing = themes[$themeType];
            if (existing !== undefined) {
                if (existing.mode === "dark") {
                    preferredDarkThemeName.set($themeType);
                    themeType.set("dark");
                }
                if (existing.mode === "light") {
                    preferredLightThemeName.set($themeType);
                    themeType.set("light");
                }
                themeName = $themeType;
            }
        }
        return themeName;
    },
);

export const currentTheme = derived(currentThemeName, (name) => {
    const theme = themes[name];
    writeCssVars("--", theme);
    return theme;
});

function createLocalStorageStore(key: string, def: string) {
    const store = writable<string>(localStorage.getItem(key) || def);
    return {
        subscribe: store.subscribe,
        set: (state: string): void => {
            store.set(state);
            localStorage.setItem(key, state);
        },
    };
}
