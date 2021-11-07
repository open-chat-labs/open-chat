import type { Theme } from "./themes";

const accent = "#ff9505";

export function originalTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "original",
        label: "Original",
        bg: "#41398b",
        mg: "20px auto",

        // accent: "#32cd32",
        // accent: "#f79031",
        accent: accent,

        panel: {
            ...defaultTheme.panel,
            pd: "0",
            bg: "#3ec4ee",
            // bg: "linear-gradient(#22A7F2, #5f2583)",
            left: {
                ...defaultTheme.panel.left,
                bg: "#f6f6f6",
            },
            right: {
                ...defaultTheme.panel.right,
                bg: "#f6f6f6",
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            mb: "0",
            bd: "1px solid #ddd",
            hv: "#efefef",
        },

        currentUser: {
            ...defaultTheme.currentUser,
            bd: "1px solid #ddd",
            bg: "#ededed",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            date: {
                bg: "#f6f6f6",
                txt: "inherit",
            },
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            mg: "0 8px",
            bg: "#ffffff",
            section: {
                txt: "#191919",
                title: {
                    ml: "8px",
                },
            },
            xs: {
                pd: "0",
            },
        },

        button: {
            ...defaultTheme.button,
            bg: "#085d8c",
            hv: "#053d5c",
            // bg: "#f79031",
            // hv: "#E37C1D",
        },

        section: {
            ...defaultTheme.section,
            bg: "#ededed",
        },

        icon: {
            ...defaultTheme.icon,
            txt: "#666",
        },

        scrollbar: {
            ...defaultTheme.scrollbar,
            bg: "rgba(255,255,255, 0.5)",
        },

        groupForm: {
            ...defaultTheme.groupForm,
            add: {
                pd: "4px 8px 0 8px",
            },
            edit: {
                pd: "4px 8px 0 8px",
            },
        },

        participants: {
            ...defaultTheme.participants,
            bg: "#fff",
            bd: "transparent",
            bdb: "1px solid #ddd",
            hv: "#efefef",
            mg: "0",
            search: {
                pd: "0",
            },
            panel: {
                bg: "transparent",
            },
        },

        findUser: {
            ...defaultTheme.findUser,
            mg: "0",
            edit: {
                ...defaultTheme.findUser.edit,
                wrapper: {
                    mg: "0",
                },
                search: {
                    mg: "0 8px 8px 8px",
                },
                selected: {
                    mg: "0 8px",
                },
                pill: {
                    txt: "#191919",
                },
            },
            add: {
                pd: "0",
                pdxs: "0",
                search: {
                    mg: "0 8px 8px 8px",
                },
                pill: {
                    txt: "#191919",
                },
            },
        },

        toast: {
            ...defaultTheme.toast,
            success: {
                bg: accent,
                // bg: "#f79031",
                txt: "#ffffff",
            },
        },
    };
}
