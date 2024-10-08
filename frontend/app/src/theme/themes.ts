import { darkTheme } from "./defaultDark";
import { getTheme as getBlueTheme } from "./community/blue";
import { getTheme as getWhiteTheme } from "./defaultLight";
import { derived, readable, writable } from "svelte/store";
import { getTheme as getSubmarineTheme } from "./community/submarine";
import { getTheme as getNightvisionTheme } from "./community/nightvision";
import { getTheme as getMatteBlackGoldTheme } from "./community/matteblackgold";
import { getTheme as getBarbieTheme } from "./community/barbie";
import { getTheme as getTokyoNightTheme } from "./community/tokyonight";
import { getTheme as getSolarizedDarkTheme } from "./community/solarizeddark";
import { getTheme as getHalloweenTheme } from "./community/halloween";
import { getTheme as getSignalsTheme } from "./community/signals";
import { getTheme as getWindoge98Theme } from "./community/windoge98";
import type { Theme, Themes } from "./types";
import { deepMerge } from "./merge";
import { createLocalStorageStore } from "../utils/store";

const blueTheme = getBlueTheme();
const defaultLight = getWhiteTheme(cloneTheme(blueTheme));
const defaultDark = darkTheme(blueTheme);

// Community themes need to be added here
export const communityThemes = [
    blueTheme,
    getSubmarineTheme(cloneTheme(defaultDark)),
    getNightvisionTheme(cloneTheme(defaultDark)),
    getMatteBlackGoldTheme(cloneTheme(defaultDark)),
    getBarbieTheme(cloneTheme(blueTheme)),
    getTokyoNightTheme(cloneTheme(defaultDark)),
    getWindoge98Theme(cloneTheme(blueTheme)),
    getSolarizedDarkTheme(cloneTheme(defaultDark)),
    getHalloweenTheme(cloneTheme(defaultDark)),
    getSignalsTheme(cloneTheme(blueTheme)),
];

export const themes: Themes = {
    white: defaultLight,
    dark: defaultDark,
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
    const base = themes[newName] ?? themes[baseName];
    if (base) {
        const overridden = deepMerge(base, overrides);
        themes[newName] = overridden;
        themeOverride.set(newName);
    }
}

export const themeOverride = writable<string>(undefined);
export const themeType = createLocalStorageStore("openchat_theme", "system");
export const preferredDarkThemeName = createLocalStorageStore("openchat_dark_theme", "dark");
export const preferredLightThemeName = createLocalStorageStore("openchat_light_theme", "white");

export const preferredDarkTheme = derived(preferredDarkThemeName, (darkName) => themes[darkName]);
export const preferredLightTheme = derived(preferredLightThemeName, (lightName) => {
    if (lightName === "light") {
        // we have renamed "light" to "blue"
        lightName = "blue";
    }
    return themes[lightName];
});

export const currentThemeName = derived(
    [themeType, preferredDarkThemeName, preferredLightThemeName, osDarkStore, themeOverride],
    ([$themeType, preferredDark, preferredLight, prefersDark, override]) => {
        if (override !== undefined) return override;

        let themeName = "white";
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

function loadFont(theme: Theme): void {
    if (theme.fontUrl) {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", theme.fontUrl);
        document.getElementsByTagName("head")[0].appendChild(link);
    }
}

export const currentTheme = derived(currentThemeName, (name) => {
    const theme = themes[name];
    loadFont(theme);
    writeCssVars("--", theme);
    return theme;
});
