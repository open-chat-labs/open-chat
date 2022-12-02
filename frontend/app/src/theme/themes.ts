import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { whiteTheme } from "./white";
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

    landing: {
        txt: string;
        "txt-light": string;
        bg: string;
        bd: string;

        context: {
            bg: string;
        };

        phone: {
            bd: string;
        };

        brag: {
            op: string;
        };

        launch: {
            bg: string;
        };

        header: {
            bg: string;
            txt: string;
            bd: string;
        };

        auth: {
            bg: string;
            txt: string;
        };

        roadmap: {
            bd: string;
        };
    };
}

export type Themes = {
    light: Theme;
    white: Theme;
    dark: Theme;
};

const defaultTheme = lightTheme();

export const themes: Themes = {
    light: defaultTheme,
    white: whiteTheme(),
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
