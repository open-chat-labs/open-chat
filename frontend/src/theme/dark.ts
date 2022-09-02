import type { Theme } from "./themes";

const darkBase = "#121212";
const dark05 = "#191919";
const dark10 = "#2b2b2b";
const dark15 = "#383838";
const dark20 = "#454545";
const dark25 = "#525252";
const dark45 = "#666666";
const dark50 = "#777777";
const dark55 = "#888888";
const dark60 = "#ababab";

const cardBg = dark10;

const txtHigh = "rgba(255,255,255,0.8)";
const txtMed = "rgba(255,255,255,0.6)";
const txtLow = "rgba(255,255,255,0.38)";

const blueAccent = "#085d8c";

export function darkTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "dark",
        label: "Dark",

        bg: darkBase,
        txt: txtHigh,
        error: "#CF6679",
        accent: "#e87fb4",

        notificationBar: {
            // bg: "#f3722b",
            bg: "#df783f",
            txt: "#ffffff",
        },

        reaction: {
            ...defaultTheme.reaction,
            bg: dark25,
            txt: txtHigh,
            me: "#085d8c",
        },

        timeline: {
            txt: txtMed,
            bg: "transparent",
        },

        toast: {
            ...defaultTheme.toast,
            failure: {
                bg: "darkred",
                txt: "#ffffff",
            },
        },

        section: {
            bg: cardBg,
            txt: txtHigh,
            bd: cardBg,
            "bd-start": cardBg,
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            // bg: "#555555",
            bg: cardBg,
            txt: txtHigh,
            bd: dark25,
        },

        participants: {
            ...defaultTheme.participants,
            bg: cardBg,
            txt: txtHigh,
            hv: dark15,
            bd: `1px solid #3d3d3d`,
            panel: {
                bg: dark10,
            },
        },

        entry: {
            bg: cardBg,
            bd: dark15,
            input: {
                bg: dark20,
                txt: txtHigh,
            },
        },

        panel: {
            ...defaultTheme.panel,
            bg: dark05,
            left: {
                bg: "rgba(0,0,0,0.1)",
                xs: "rgba(0,0,0,0.1)",
            },
            right: {
                bg: dark10,
            },
        },

        currentUser: {
            bd: `1px solid ${cardBg}`,
            bg: cardBg,
            txt: txtHigh,
            ic: dark60,
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            bd: dark25,
            sh: "none",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: cardBg,
            txt: txtHigh,
            bd: dark20,

            section: {
                ...defaultTheme.chatSearch.section,
                txt: txtHigh,
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            bg: cardBg,
            "bg-selected": dark15,
            hv: dark15,
            txt1: txtHigh,
            txt2: txtMed,
            bd: "1px solid #3d3d3d",
            del: "#085d8c",
        },

        menu: {
            bg: dark15,
            txt: txtMed,
            "disabled-txt": txtLow,
            bd: dark20,
            hv: "#424242",
            sh: "-10px 10px 10px 0px rgba(8,93,140,0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(8,93,140,0.3)",
        },

        button: {
            bg: blueAccent,
            hv: "#053d5c",
            txt: txtHigh,
            bd: "transparent",
            disabled: dark20,
            spinner: dark60,
            "disabled-txt": "#999999",
            "disabled-bd": "#999999",
        },

        modal: {
            bg: cardBg,
            txt: txtHigh,
            sh: "0px 0px 0px 10px rgba(8,93,140,0.4)",
            filter: "blur(5px)",
            header: {
                bg: dark15,
                txt: txtHigh,
                bd: dark15,
            },
            footer: {
                bg: dark15,
                txt: txtHigh,
                bd: dark15,
            },
        },

        modalPage: {
            bg: "rgba(0, 0, 0, 0.4)",
            txt: txtHigh,
            sh: "none",
            filter: "blur(10px)",
            bd: "1px inset rgba(255, 255, 255, 0.1)",
            "txt-sh": "1px 1px rgba(0, 0, 0, 0.2)",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            header: {
                bg: dark20,
                txt: txtHigh,
                bd: dark15,
            },
            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: cardBg,
                txt: txtMed,
                hv: dark15,
                bd: dark15,
                muted: txtLow,
                "reply-accent": blueAccent,

                me: {
                    bg: "#820041",
                    txt: dark60,
                    hv: "#680034",
                    bd: "#820041",
                    muted: dark50,
                },
            },
        },

        icon: {
            color: dark25,
            // hv: dark25,
            hv: "rgba(255,255,255,0.2)",
            txt: txtMed,
            inverted: {
                hv: "rgba(0,0,0,0.1)",
            },
            msg: {
                hv: "rgba(255,255,255,0.2)",
            },
        },
        spinner: dark25,

        findUser: {
            ...defaultTheme.findUser,
            add: {
                ...defaultTheme.findUser.add,
                pill: {
                    txt: "#fff",
                },
            },
        },

        recommended: {
            ...defaultTheme.recommended,
            bg: dark15,
        },

        profile: {
            ...defaultTheme.profile,
            section: {
                ...defaultTheme.profile.section,
                bg: cardBg,
                xs: {
                    ...defaultTheme.profile.section.xs,
                    bd: `1px solid ${cardBg}`,
                },
            },
        },

        collapsible: {
            header: {
                bg: dark15,
                bd: `1px solid ${dark15}`,
            },
            bg: cardBg,
        },

        toggle: {
            bg: dark45,
        },

        thread: {
            preview: {
                bg: "transparent",
            },
        },

        markdown: {
            fg: {
                color: dark60,
                bright: "#cacaca",
                muted: dark55,
            },
            bg: {
                dark: dark15,
            },
        },
    };
}
