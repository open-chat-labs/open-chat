import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { derived, readable, writable } from "svelte/store";

// these are the gradients used in the logo (from light to dark)
// const blueFrom = "#28aae2";
// const blueTo = "#146b91";
// const blueGradient = `linear-gradient(${blueFrom}, ${blueTo})`;
// const orangeFrom = "#fbb03b";
// const orangeTo = "#f05a24";
// const orangeGradient = `linear-gradient(${orangeFrom}, ${orangeTo})`;
// const purpleFrom = "#ed1e79";
// const purpleTo = "#5f2583";
// const purpleGradient = `linear-gradient(${purpleFrom}, ${purpleTo})`;

export interface Theme {
    name: string;
    label: string;

    bg: string;
    txt: string;

    error: string;
    accent: string;
    accentDarker: string;

    placeholder: string;

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
        txt: string;
        bd: string;
        "bd-start": string;
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
        txt: string;
        bd: string;
    };

    participants: {
        bg: string;
        txt: string;
        hv: string;
        bd: string;
        bdb: string;
        panel: {
            bg: string;
        };
    };

    entry: {
        bg: string;
        bd: string;
        input: {
            txt: string;
            bg: string;
        };
    };

    panel: {
        bg: string;
        left: {
            bg: string;
            xs: string;
        };
        right: {
            bg: string;
        };
    };

    currentUser: {
        bd: string;
        bg: string;
        txt: string;
        ic: string;
    };

    avatar: {
        bg: string;
        bd: string;
        sh: string;
    };

    chatSearch: {
        bg: string;
        txt: string;
        bd: string;

        section: {
            txt: string;
        };
    };

    chatSummary: {
        bg: string;
        "bg-selected": string;
        hv: string;
        txt1: string;
        txt2: string;
        bd: string;
        del: string;
    };

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        "disabled-txt": string;
        bd: string;
        hv: string;
        sh: string;
        "inverted-sh": string;
    };

    button: {
        bg: string;
        hv: string;
        txt: string;
        bd: string;
        disabled: string;
        spinner: string;
        "disabled-txt": string;
        "disabled-bd": string;
    };

    link: {
        underline: string;
    };

    modal: {
        txt: string;
        bg: string;
        sh: string;
        filter: string;
        header: {
            txt: string;
            bg: string;
            bd: string;
        };
        footer: {
            txt: string;
            bg: string;
            bd: string;
        };
    };

    modalPage: {
        bg: string;
        txt: string;
        sh: string;
        filter: string;
        bd: string;
        "txt-sh": string;
    };

    currentChat: {
        header: {
            bg: string;
            txt: string;
            bd: string;
        };
        msgs: {
            bg: string;
        };
        date: {
            bg: string;
            txt: string;
        };
        msg: {
            bg: string;
            txt: string;
            hv: string;
            bd: string;
            muted: string;
            "reply-accent": string;

            me: {
                bg: string;
                txt: string;
                hv: string;
                bd: string;
                muted: string;
            };
        };
    };

    icon: {
        color: string;
        hv: string;
        txt: string;
        inverted: {
            hv: string;
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

    profile: {
        section: {
            bd: string;
            bg: string;

            xs: {
                bd: string;
            };
        };
    };

    collapsible: {
        header: {
            bg: string;
            bd: string;
        };
        bg: string;
    };

    toggle: {
        bg: string;
    };
}

export type Themes = {
    light: Theme;
    dark: Theme;
};

const defaultTheme = lightTheme();

export const themes: Themes = {
    light: defaultTheme,
    dark: darkTheme(defaultTheme),
};

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

export const themeNameStore = writable<string | null>(getCurrentThemeName());

export const themeStore = derived([osDarkStore, themeNameStore], ([$dark, $themeName]) =>
    themeByName($themeName, $dark)
);

themeStore.subscribe((theme) => writeCssVars("--", theme));

function themeByName(name: string | null, prefersDark: boolean): Theme {
    if (!name || name === "system") {
        return prefersDark ? themes.dark : themes.light;
    }
    return themes[name as keyof Themes] ?? themes.light;
}

export function getCurrentThemeName(): string {
    return localStorage.getItem("openchat_theme") ?? "system";
}

export function saveSeletedTheme(themeName: string): void {
    themeNameStore.set(themeName);
    localStorage.setItem("openchat_theme", themeName);
}
