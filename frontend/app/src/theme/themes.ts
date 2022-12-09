import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { getTheme as getWhiteTheme } from "./community/white";
import { derived, readable, writable } from "svelte/store";
import { getTheme as getSubmarineTheme } from "./community/submarine";

const defaultTheme = lightTheme();
const dark = darkTheme(defaultTheme);
const white = getWhiteTheme(cloneTheme(defaultTheme));
const submarine = getSubmarineTheme(cloneTheme(dark));

export const communityThemes = [white, submarine];

const themes: Themes = {
    light: defaultTheme,
    dark,
    white,
    submarine,
};

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

export interface Theme {
    name: string;
    label: string;
    burst: boolean;

    bg: string;
    txt: string;
    "txt-light": string;
    bd: string;

    error: string;
    accent: string;
    accentDarker: string;
    disabledTxt: string;
    primary: string;

    placeholder: string;

    progress: {
        bd: string;
    };

    collapsible: {
        closed: {
            header: {
                txt: string;
            };
        };
        open: {
            header: {
                arrow: string;
            };
        };
    };

    notificationBar: {
        bg: string;
        txt: string;
    };

    reaction: {
        bg: string;
        txt: string;
        me: string;
    };

    timeline: {
        txt: string;
        bg: string;
    };

    section: {
        bg: string;
    };

    "sub-section": {
        bg: string;
    };

    toast: {
        failure: {
            bg: string;
            txt: string;
        };
        success: {
            bg: string;
            txt: string;
        };
    };

    input: {
        bg: string;
        sh: string;
    };

    members: {
        hv: string;
    };

    entry: {
        bg: string;
        input: {
            bg: string;
            sh: string;
        };
    };

    panel: {
        bg: string;

        left: {
            bg: string;
        };

        right: {
            bg: string;

            modal: string;
        };
    };

    avatar: {
        bg: string;
        sh: string;
    };

    chatSearch: {
        bg: string;
        sh: string;
    };

    chatSummary: {
        "bg-selected": string;
        hv: string;
        del: string;
    };

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        "disabled-txt": string;
        hv: string;
        sh: string;
        "inverted-sh": string;
        bd: string;
    };

    button: {
        bg: string;
        hv: string;
        txt: string;
        disabled: string;
        spinner: string;
        "disabled-txt": string;
        "disabled-bd": string;
    };

    link: {
        underline: string;
    };

    modal: {
        filter: string;
        bg: string;
        bd: string;
    };

    modalPage: {
        bg: string;
        txt: string;
        sh: string;
        filter: string;
        "txt-sh": string;
    };

    currentChat: {
        msgs: {
            bg: string;
        };
        date: {
            bg: string;
            txt: string;
        };
        msg: {
            bg: string;
            muted: string;
            txt: string;
            inert: string;

            me: {
                bg: string;
                muted: string;
                txt: string;
                bd: string;
            };
        };
    };

    icon: {
        hv: string;
        txt: string;
        inverted: {
            hv: string;
            txt: string;
        };
        msg: {
            hv: string;
        };
    };

    scrollbar: {
        bg: string;
    };

    findUser: {
        edit: {
            pill: {
                txt: string;
            };
        };
        add: {
            pill: {
                txt: string;
            };
        };
    };

    recommended: {
        bg: string;
    };

    toggle: {
        bg: string;
    };

    thread: {
        preview: {
            bg: string;
        };
    };

    vote: {
        yes: {
            color: string;
            hv: string;
        };
        no: {
            color: string;
            hv: string;
        };
        maybe: {
            color: string;
        };
    };

    markdown: {
        fg: {
            color: string;
            bright: string;
            muted: string;
        };
    };
}

export type Themes = Record<string, Theme> & {
    light: Theme;
    dark: Theme;
};

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
