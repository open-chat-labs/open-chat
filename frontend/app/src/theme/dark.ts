import type { Theme } from "./themes";

const darkBase = "#1B1C21";

const dark30pc = `${darkBase}4d`;
const dark50pc = `${darkBase}80`;
const dark60pc = `${darkBase}99`;
const darkBorder = "#32353F";

const selectedChat = "#32353F80";
const hoveredChat = "#32353F40";

const textBox = "#242834";

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

const txtHigh = "#ffffff";
const txtMed = "#b1b1b1";
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
        disabledTxt: txtLow,

        notificationBar: {
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
            bg: "transparent",
            txt: txtHigh,
            bd: darkBorder,
            "bd-start": cardBg,
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            // bg: "#555555",
            bg: cardBg,
            txt: txtHigh,
            bd: darkBorder,
        },

        members: {
            ...defaultTheme.members,
            hv: hoveredChat,
        },

        entry: {
            bg: dark60pc,
            bd: darkBorder,
            input: {
                bg: textBox,
                txt: txtHigh,
            },
        },

        panel: {
            ...defaultTheme.panel,
            bg: dark05,
            bd: darkBorder,
            left: {
                bg: dark30pc,
                // bg: "rgba(0,0,0,0.1)",
                xs: dark30pc,
            },
            right: {
                bg: dark30pc,
            },
        },

        currentUser: {
            txt: txtHigh,
            ic: dark60,
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            bd: darkBorder,
            sh: "none",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: textBox,
            txt: txtHigh,
            bd: darkBorder,

            section: {
                ...defaultTheme.chatSearch.section,
                txt: txtHigh,
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            "bg-selected": selectedChat,
            hv: hoveredChat,
            txt1: txtHigh,
            txt2: txtMed,
            del: "#085d8c",
        },

        menu: {
            bg: dark15,
            txt: txtMed,
            "disabled-txt": txtLow,
            bd: darkBorder,
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
                bd: darkBorder,
            },
            footer: {
                bg: dark60pc,
                txt: txtHigh,
                bd: darkBorder,
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
                txt: txtHigh,
                bd: darkBorder,
            },
            msgs: {
                bg: "transparent",
            },

            date: {
                bg: "rgba(100,100,100,0.7)",
                txt: "inherit",
            },

            msg: {
                bg: textBox,
                txt: txtHigh,
                hv: dark15,
                muted: txtLow,
                "reply-accent": blueAccent,

                me: {
                    hv: "#680034",
                    muted: dark50,
                },
            },
        },

        icon: {
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
                bg: "transparent",
                xs: {
                    ...defaultTheme.profile.section.xs,
                    bd: `1px solid ${darkBorder}`,
                },
            },
        },

        collapsible: {
            header: {
                bg: dark15,
                bd: `1px solid ${darkBorder}`,
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
