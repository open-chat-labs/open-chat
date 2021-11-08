import { originalTheme } from "./original";
import { darkTheme } from "./dark";
import { lightTheme } from "./light";

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

    mg: string;
    bg: string;
    txt: string;

    error: string;
    accent: string;

    notificationBar: {
        bg: string;
        txt: string;
    };

    reaction: {
        bg: string;
        txt: string;
    };

    timeline: {
        txt: string;
        bg: string;
    };

    section: {
        bg: string;
        txt: string;
        bd: string;
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
        mg: string;
        search: {
            pd: string;
        };
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
        pd: string;
        bg: string;
        left: {
            bg: string;
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
        mg: string;

        section: {
            txt: string;
            title: {
                ml: string;
            };
        };

        xs: {
            pd: string;
        };
    };

    chatSummary: {
        bg: string;
        hv: string;
        txt1: string;
        txt2: string;
        bd: string;
        "bd-selected": string;
        mb: string;
    };

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        "disabled-txt": string;
        bd: string;
        hv: string;
        sh: string;
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

            me: {
                bg: string;
                txt: string;
                hv: string;
                bd: string;
            };
        };
    };

    icon: {
        color: string;
        hv: string;
        txt: string;
    };

    scrollbar: {
        bg: string;
    };

    groupForm: {
        add: {
            pd: string;
        };
        edit: {
            pd: string;
        };
    };

    findUser: {
        mg: string;
        edit: {
            wrapper: {
                mg: string;
            };
            search: {
                mg: string;
            };
            selected: {
                mg: string;
            };
            pill: {
                txt: string;
            };
        };
        add: {
            pd: string;
            pdxs: string;
            search: {
                mg: string;
            };
            pill: {
                txt: string;
            };
        };
    };
}

export type Themes = {
    light: Theme;
    dark: Theme;
    original: Theme;
};

const defaultTheme = lightTheme();

export const themes: Themes = {
    light: defaultTheme,
    original: originalTheme(defaultTheme),
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

function osDark(): boolean {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    return prefersDarkScheme.matches;
}

function themeByName(name: string | null): Theme {
    if (!name) return themes.light;

    if (name === "system") {
        return osDark() ? themes.dark : themes.light;
    }

    return themes[name as keyof Themes] ?? themes.light;
}

export function getCurrentThemeName(): string {
    return localStorage.getItem("openchat_theme") ?? "light";
}

export function loadAndApplySavedTheme(): string {
    const themeName = localStorage.getItem("openchat_theme");
    const theme = themeByName(themeName);
    writeCssVars("--", theme);
    return themeName ?? "light";
}

export function saveSeletedTheme(themeName: string): void {
    const theme = themeByName(themeName);
    writeCssVars("--", theme);
    localStorage.setItem("openchat_theme", themeName);
}
