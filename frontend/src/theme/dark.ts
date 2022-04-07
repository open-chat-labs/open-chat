import type { Theme } from "./themes";

const darkBase = "#121212";
const dark05 = "#191919";
const dark10 = "#2b2b2b";
const dark15 = "#383838";
const dark20 = "#454545";
const dark25 = "#525252";
const dark45 = "#666666";
const dark60 = "#ababab";

const blueAccent = "#085d8c";

export function darkTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "dark",
        label: "Dark",

        bg: darkBase,
        txt: dark60,
        error: "#CF6679",
        accent: "hotpink",

        notificationBar: {
            bg: "#f3722b",
            txt: "#ffffff",
        },

        reaction: {
            ...defaultTheme.reaction,
            bg: dark25,
            txt: dark60,
            me: "#085d8c",
        },

        timeline: {
            txt: "rgba(255,255,255,0.7)",
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
            bg: dark20,
            txt: dark60,
            bd: dark15,
            "bd-start": dark15,
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            bg: "#555555",
            txt: dark60,
            bd: dark15,
        },

        participants: {
            ...defaultTheme.participants,
            bg: dark20,
            txt: dark60,
            hv: dark15,
            bd: `1px solid ${dark15}`,
            panel: {
                bg: dark10,
            },
        },

        entry: {
            bg: dark20,
            bd: dark15,
            input: {
                bg: "#555555",
                txt: dark60,
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
            bd: `1px solid ${dark15}`,
            bg: dark20,
            txt: dark60,
            ic: dark60,
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            bd: dark25,
            sh: "none",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: "#555555",
            txt: dark60,
            bd: dark15,

            section: {
                ...defaultTheme.chatSearch.section,
                txt: dark60,
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            bg: dark20,
            hv: dark15,
            txt1: dark60,
            txt2: "#888888",
            bd: dark10,
            del: "#085d8c",
        },

        menu: {
            bg: dark15,
            txt: dark60,
            "disabled-txt": dark45,
            bd: dark20,
            hv: "#424242",
            sh: "-10px 10px 10px 0px rgba(8,93,140,0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(8,93,140,0.3)",
        },

        button: {
            bg: blueAccent,
            hv: "#053d5c",
            txt: "#ffffff",
            bd: "transparent",
            disabled: dark20,
            spinner: dark60,
            "disabled-txt": "#999999",
            "disabled-bd": "#999999",
        },

        link: {
            underline: "#085d8c",
        },

        modal: {
            bg: dark20,
            txt: dark60,
            sh: "0px 0px 0px 10px rgba(8,93,140,0.4)",
            filter: "blur(5px)",
            header: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
            footer: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
        },

        modalPage: {
            bg: "rgba(0, 0, 0, 0.4)",
            txt: dark60,
            sh: "none",
            filter: "blur(10px)",
            bd: "1px inset rgba(255, 255, 255, 0.1)",
            "txt-sh": "1px 1px rgba(0, 0, 0, 0.2)",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            header: {
                bg: dark20,
                txt: dark60,
                bd: dark15,
            },
            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: dark20,
                txt: dark60,
                hv: dark10,
                bd: dark15,
                "reply-accent": blueAccent,

                me: {
                    bg: "#820041",
                    txt: dark60,
                    hv: "#680034",
                    bd: "#820041",
                },
            },
        },

        icon: {
            color: dark25,
            // hv: dark25,
            hv: "rgba(255,255,255,0.2)",
            txt: dark60,
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
                pd: "8px",
                pill: {
                    txt: "#fff",
                },
            },
        },

        recommended: {
            ...defaultTheme.recommended,
            bg: dark25,
        },

        profile: {
            ...defaultTheme.profile,
            section: {
                ...defaultTheme.profile.section,
                bg: dark25,
                xs: {
                    ...defaultTheme.profile.section.xs,
                    mg: "0",
                    bd: `1px solid ${dark15}`,
                },
            },
        },

        collapsible: {
            header: {
                bg: dark20,
                bd: `1px solid ${dark15}`,
            },
            bg: dark25,
        },

        toggle: {
            bg: dark45,
        },
    };
}
