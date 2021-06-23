
export interface Theme {
    name: string;
    label: string;

    bg: string;
    txt: string;

    participants: {
        bg: string;
        txt: string;
        hv: string;
        bd: string;
        header: {
            bg: string;
            txt: string;
            bd: string;
        }
    }

    entry: {
        bg: string;
        bd: string;
        input: {
            txt: string;
            bg: string;
        }
    }

    panel: {
        bg: string;
    }

    currentUser: {
        bd: string;
        bg: string;
        txt: string;
        ic: string;
    }

    avatar: {
        bd: string;
        sh: string;
    }

    chatSearch: {
        bg: string;
        txt: string;
        bd: string;
    }

    chatSummary: {
        bg: string;
        hv: string;
        txt1: string;
        txt2: string;
        bd: string;
        "bd-selected": string;
    }

    spinner: string;

    menu: {
        bg: string;
        txt: string;
        bd: string;
        hv: string;
        sh: string;
    }

    button: {
        bg: string;
        hv: string;
        txt: string;
        bd: string;
        disabled: string;
    }

    modal: {
        txt: string;
        bg: string;
        sh: string;
        filter: string;
        header: {
            txt: string;
            bg: string;
            bd: string;
        }
        footer: {
            txt: string;
            bg: string;
            bd: string;
        }
    }

    currentChat: {
        header: {
            bg: string;
            txt: string;
            bd: string;
        }
        msgs: {
            bg: string;
        }
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
            }
        }
    }

    icon: {
        color: string;
        hv: string;
    }
}

export type Themes = {
    light: Theme;
    batman: Theme;
}

const defaultTheme = {
    name: "light",
    label: "Light",

    bg: "linear-gradient(#22A7F2, #EF5DA8)",
    txt: "#191919",

    participants: {
        bg: "#efefef",
        txt: "#191919",
        hv: "#e2e2e2",
        bd: "transparent",
        header: {
            bg: "#efefef",
            txt: "#191919",
            bd: "transparent",
        }
    },

    entry: {
        bg: "#efefef",
        bd: "#dddddd",
        input: {
            bg: "#ffffff",
            txt: "#191919",
        }
    },

    panel: {
        bg: "linear-gradient(#22A7F2, #EF5DA8)"
    },

    currentUser: {
        bd: "transparent",
        bg: "#efefef",
        txt: "#191919",
        ic: "#aaa",
    },

    avatar: {
        bd: "#cccccc",
        sh: "2px 2px 4px #e2e2e2",
    },

    chatSearch: {
        bg: "#ffffff",
        txt: "#555555",
        bd: "#dddddd",
    },

    chatSummary: {
        bg: "#efefef",
        hv: "#e2e2e2",
        txt1: "#191919",
        txt2: "#aaaaaa",
        bd: "transparent",
        "bd-selected": "#22a7f2",
    },

    spinner: "#ffffff",

    menu: {
        bg: "#efefef",
        txt: "#191919",
        bd: "#cccccc",
        hv: "#e2e2e2",
        sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
    },

    button: {
        bg: "#22A7F2",
        hv: "#52baf5",
        txt: "#ffffff",
        bd: "transparent",
        disabled: "#cccccc",
    },

    modal: {
        bg: "#ffffff",
        txt: "#191919",
        sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
        filter: "blur(5px)",
        header: {
            bg: "#ffffff",
            txt: "#191919",
            bd: "#dfdfdf",
        },
        footer: {
            bg: "#efefef",
            txt: "#191919",
            bd: "#dddddd",
        },
    },

    currentChat: {
        header: {
            bg: "#efefef",
            txt: "#191919",
            bd: "transparent",
        },

        msgs: {
            bg: "transparent",
        },

        msg: {
            bg: "#ffffff",
            txt: "#191919",
            hv: "transparent",
            bd: "#cccccc",

            me: {
                bg: "#ff69b4",
                txt: "#ffffff",
                hv: "#ff4fa7",
                bd: "#ff69b4",
            }
        }
    },

    icon: {
        color: "#cccccc",
        hv: "#dddddd",
    }
};

export const themes: Themes = {
    light: defaultTheme,
    batman: {
        ...defaultTheme,
        name: "batman",
        label: "Batman",

        bg: "#121212",
        txt: "#aaaaaa",

        participants: {
            bg: "#252525",
            txt: "#aaaaaa",
            hv: "#353535",
            bd: "#333333",
            header: {
                bg: "#252525",
                txt: "#aaaaaa",
                bd: "#333333"
            }
        },

        entry: {
            bg: "#252525",
            bd: "#333333",
            input: {
                bg: "#555555",
                txt: "#aaaaaa",
            }
        },

        panel: {
            bg: "#121212"
        },

        currentUser: {
            bd: "#333333",
            bg: "#252525",
            txt: "#aaaaaa",
            ic: "#aaa",
        },

        avatar: {
            bd: "transparent",
            sh: "none",
        },

        chatSearch: {
            bg: "#555555",
            txt: "#aaaaaa",
            bd: "#333333",
        },

        chatSummary: {
            bg: "#252525",
            hv: "#353535",
            txt1: "#aaaaaa",
            txt2: "#888888",
            bd: "#222222",
            "bd-selected": "#085d8c",
        },

        menu: {
            bg: "#353535",
            txt: "#aaaaaa",
            bd: "#454545",
            hv: "#424242",
            sh: "0px 0px 30px 10px rgba(8,93,140,0.3)",
        },

        button: {
            bg: "#085d8c",
            hv: "#053d5c",
            txt: "#ffffff",
            bd: "transparent",
            disabled: "#cccccc",
        },

        modal: {
            bg: "#252525",
            txt: "#aaaaaa",
            sh: "0px 0px 30px 10px rgba(8,93,140,0.5)",
            filter: "blur(5px)",
            header: {
                bg: "#252525",
                txt: "#aaaaaa",
                bd: "#333333",
            },
            footer: {
                bg: "#252525",
                txt: "#aaaaaa",
                bd: "#333333",
            },
        },

        currentChat: {
            header: {
                bg: "#252525",
                txt: "#aaaaaa",
                bd: "#333333",
            },
            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: "#252525",
                txt: "#aaaaaa",
                hv: "#292929",
                bd: "#333333",

                me: {
                    bg: "#820041",
                    txt: "#aaaaaa",
                    hv: "#680034",
                    bd: "#820041",
                }
            }
        },

        icon: {
            color: "#555555",
            hv: "#555555",
        },
        spinner: "#555555",
    },
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

function osDark(): boolean {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    return prefersDarkScheme.matches;
}

function themeByName(name: string | null): Theme {
    if (!name)
        return themes.light;

    if (name === "system") {
        return osDark()
            ? themes.batman
            : themes.light;
    }

    return themes[name as (keyof Themes)] ?? themes.light;
}

export function loadSavedTheme(): string {
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