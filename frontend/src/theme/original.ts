import type { Theme } from "./themes";

const accent = "#59df59";
const accentDarker = "rgba(4, 104, 4, 0.8)";

export function originalTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "original",
        label: "Original",
        bg: "#41398b",

        accent: accent,
        accentDarker: accentDarker,

        notificationBar: {
            ...defaultTheme.notificationBar,
            bg: accent,
        },

        panel: {
            ...defaultTheme.panel,
            bg: "#3ec4ee",
            // bg: "linear-gradient(#22A7F2, #5f2583)",
            left: {
                ...defaultTheme.panel.left,
                bg: "#f6f6f6",
                xs: "#f6f6f6",
            },
            right: {
                ...defaultTheme.panel.right,
                bg: "#f6f6f6",
            },
        },

        toast: {
            ...defaultTheme.toast,
            success: {
                ...defaultTheme.toast.success,
                bg: accent,
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            txt2: "rgba(0, 0, 0, 0.6)",
            del: accent,
        },

        currentUser: {
            ...defaultTheme.currentUser,
            bg: "#ededed",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            date: {
                bg: "#f6f6f6",
                txt: "inherit",
            },
            msg: {
                ...defaultTheme.currentChat.msg,
                "reply-accent": accent,
                me: {
                    ...defaultTheme.currentChat.msg.me,
                    bg: "#d62c7d",
                    bd: "#d62c7d",
                    hv: "#EA4091",
                },
            },
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: "#ffffff",
            mg: "0 8px",
            pd: "0 16px",
            section: {
                txt: "#191919",
                title: {
                    ml: "8px",
                },
            },
            xs: {
                pd: "0",
                mg: "0 8px",
            },
        },

        button: {
            ...defaultTheme.button,
            bg: "#085d8c",
            // bg: accent,
            hv: "#053d5c",
            // hv: accentDarker,
        },

        section: {
            ...defaultTheme.section,
            bg: "#ededed",
            "bd-start": "#e0e0e0",
        },

        scrollbar: {
            ...defaultTheme.scrollbar,
            bg: "rgba(0, 0, 0, 0.15)",
        },

        groupForm: {
            ...defaultTheme.groupForm,
            add: {
                pd: "4px 8px 0 8px",
            },
            edit: {
                pd: "8px",
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

        profile: {
            ...defaultTheme.profile,
            section: {
                mg: "0",
                bd: "1px solid #ddd",
                bg: "#efefef",
                xs: {
                    mg: "0",
                    bd: "1px solid #ddd",
                },
            },
        },

        collapsible: {
            header: {
                bg: "#efefef",
                bd: "1px solid #ddd",
            },
            bg: "#fff",
        },

        toggle: {
            bg: "#cccccc",
        },
    };
}
