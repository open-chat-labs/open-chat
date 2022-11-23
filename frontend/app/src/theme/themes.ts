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
    "txt-light": string;
    bd: string;

    error: string;
    accent: string;
    accentDarker: string;
    disabledTxt: string;
    primary: string;

    placeholder: string;

    collapsible: {
        closed: {
            header: {
                txt: string;
            };
        };
        open: {
            header: {
                txt: string;
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
        txt: string;
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
        sh: string;
    };

    members: {
        hv: string;
    };

    entry: {
        bg: string;
        input: {
            txt: string;
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
        txt: string;
        sh: string;

        section: {
            txt: string;
        };
    };

    chatSummary: {
        "bg-selected": string;
        hv: string;
        txt1: string;
        txt2: string;
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
        txt: string;
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
        bg: {
            dark: string;
        };
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
