import type { Theme } from "./themes";

const backgroundBlack = "#1B1C21";

const dark60pc = `${backgroundBlack}99`;

const borderDark = "#32353F";
const borderLight = "#ededed";
const textBlack = "#242834";
const textBodyLight = "#5C5C5C";
const textBodyDark = "#b1b1b1";

function hexPercent(hx: string, pc: number) {
    const n = (pc / 100) * 255;
    return `${hx}${Math.round(n).toString(16)}`;
}

const selectedChat = hexPercent(borderDark, 50);
const hoveredChat = hexPercent(borderDark, 70);
const chatPanelDark = hexPercent(backgroundBlack, 30);
const orangeAccent = "#ff8541";

const dark15 = "#383838";
const dark25 = "#525252";
const dark45 = "#666666";
const dark50 = "#777777";
const dark55 = "#888888";
const dark60 = "#ababab";

const txtHigh = "#ffffff";
const txtLow = "rgba(255,255,255,0.38)";

const primary = "#23a2ee";
const blueAccent = "#085d8c";

export function darkTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "dark",
        label: "Dark",

        bg: backgroundBlack,
        txt: txtHigh,
        "txt-light": textBodyDark,
        bd: borderDark,
        error: "#CF6679",
        // accent: "#e87fb4",
        accent: "#ff005c",
        disabledTxt: txtLow,
        primary,

        collapsible: {
            closed: {
                header: {
                    txt: textBodyDark,
                },
            },
            open: {
                header: {
                    txt: txtHigh,
                    arrow: primary,
                },
            },
        },

        notificationBar: {
            bg: orangeAccent,
            txt: "#ffffff",
        },

        reaction: {
            ...defaultTheme.reaction,
            bg: textBlack,
            txt: txtHigh,
            me: "#085d8c",
        },

        timeline: {
            txt: textBodyDark,
            bg: "transparent",
        },

        toast: {
            ...defaultTheme.toast,
            failure: {
                bg: "#ff005c",
                txt: "#ffffff",
            },
            success: {
                bg: "#05b09f",
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
            bg: textBlack,
            txt: txtHigh,
            sh: "none",
        },

        members: {
            ...defaultTheme.members,
            hv: hoveredChat,
        },

        entry: {
            bg: dark60pc,
            input: {
                bg: textBlack,
                txt: txtHigh,
                sh: "inset 0px 2px 4px rgba(0, 0, 0, 0.8)",
            },
        },

        panel: {
            ...defaultTheme.panel,
            bg: chatPanelDark,

            left: {
                bg: chatPanelDark,
            },

            right: {
                bg: chatPanelDark,
                modal: backgroundBlack,
            },
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            sh: "none",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: textBlack,
            txt: txtHigh,
            sh: "inset 0px 2px 4px rgba(0, 0, 0, 0.8)",

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
            txt2: textBodyDark,
            del: "#085d8c",
        },

        menu: {
            bg: backgroundBlack,
            txt: textBodyDark,
            "disabled-txt": txtLow,
            hv: hoveredChat,
            sh: "none",
            "inverted-sh": "0px -10px 10px 0px rgba(8,93,140,0.3)",
            bd: textBodyLight,
        },

        button: {
            bg: blueAccent,
            hv: "#053d5c",
            txt: txtHigh,
            disabled: textBlack,
            spinner: dark60,
            "disabled-txt": "#999999",
            "disabled-bd": "#999999",
        },

        modal: {
            filter: "blur(5px)",
            bg: backgroundBlack,
            txt: txtHigh,
            bd: `1px solid ${borderDark}`,
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
            msgs: {
                bg: "transparent",
            },

            date: {
                // bg: "rgba(100,100,100,0.7)",
                bg: textBlack,
                txt: "inherit",
            },

            msg: {
                bg: textBlack,
                muted: txtLow,
                txt: "rgba(255,255,255,0.8)",

                me: {
                    bg: blueAccent,
                    muted: "rgba(255,255,255,0.5)",
                    txt: "rgba(255,255,255,0.8)",
                    bd: "transparent",
                },
            },
        },

        icon: {
            hv: "rgba(255,255,255,0.1)",
            txt: textBodyDark,
            inverted: {
                hv: "rgba(0,0,0,0.1)",
                txt: textBodyDark,
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
            // bg: dark15,
            // bg: "rgba(0,0,0,0.3)",
            bg: selectedChat,
            // bg: textBox,
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
                color: txtHigh,
                bright: txtHigh,
                muted: textBodyLight,
            },
        },
    };
}
