import type { Theme } from "./themes";

const darkBase = "#1B1C21";

const dark60pc = `${darkBase}99`;
const darkBorder = "#32353F";

const selectedChat = "#32353F80";
const hoveredChat = "#32353F40";

const textBox = "#242834";

const dark15 = "#383838";
const dark25 = "#525252";
const dark45 = "#666666";
const dark50 = "#777777";
const dark55 = "#888888";
const dark60 = "#ababab";

const txtHigh = "#ffffff";
const txtMed = "#b1b1b1";
const txtLow = "rgba(255,255,255,0.38)";

const primary = "#23a2ee";
const blueAccent = "#085d8c";

export function darkTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "dark",
        label: "Dark",

        bg: darkBase,
        txt: txtHigh,
        "txt-light": txtMed,
        bd: darkBorder,
        error: "#CF6679",
        accent: "#e87fb4",
        disabledTxt: txtLow,
        primary,

        collapsible: {
            open: primary,
        },

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
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            // bg: "#555555",
            bg: textBox,
            txt: txtHigh,
        },

        members: {
            ...defaultTheme.members,
            hv: hoveredChat,
        },

        entry: {
            bg: dark60pc,
            input: {
                bg: textBox,
                txt: txtHigh,
            },
        },

        panel: {
            ...defaultTheme.panel,
            bg: darkBase,

            left: {
                bg: "transparent",
            },

            right: {
                bg: "transparent",
                modal: darkBase,
            },
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            sh: "none",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: textBox,
            txt: txtHigh,

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
            bg: textBox,
            txt: txtMed,
            "disabled-txt": txtLow,
            hv: hoveredChat,
            sh: "none",
            "inverted-sh": "0px -10px 10px 0px rgba(8,93,140,0.3)",
        },

        button: {
            bg: blueAccent,
            hv: "#053d5c",
            txt: txtHigh,
            disabled: textBox,
            spinner: dark60,
            "disabled-txt": "#999999",
            "disabled-bd": "#999999",
        },

        modal: {
            filter: "blur(5px)",
            bg: darkBase,
            txt: txtHigh,
        },

        modalPage: {
            bg: "rgba(0, 0, 0, 0.4)",
            txt: txtHigh,
            sh: "none",
            filter: "blur(10px)",
            "txt-sh": "1px 1px rgba(0, 0, 0, 0.2)",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            header: {
                txt: txtHigh,
            },
            msgs: {
                bg: "transparent",
            },

            date: {
                // bg: "rgba(100,100,100,0.7)",
                bg: textBox,
                txt: "inherit",
            },

            msg: {
                bg: textBox,
                muted: txtLow,
                txt: txtHigh,

                me: {
                    bg: primary,
                    muted: dark50,
                },
            },
        },

        icon: {
            hv: "rgba(255,255,255,0.1)",
            txt: txtMed,
            inverted: {
                hv: "rgba(0,0,0,0.1)",
                txt: txtMed,
            },
            msg: {
                hv: "rgba(255,255,255,0.1)",
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
