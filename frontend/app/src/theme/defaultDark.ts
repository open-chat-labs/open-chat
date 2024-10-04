import { hexPercent } from "./utils";
import type { Theme } from "./types";

const backgroundBlack = "#1B1C21";

const dark60pc = `${backgroundBlack}99`;

const borderDark = "#32353F";
const textBlack = "#242834";
const textBodyLight = "#5C5C5C";
const textBodyDark = "#b1b1b1";

const selectedChat = hexPercent(borderDark, 50);
const hoveredChat = hexPercent(borderDark, 70);
const chatPanelDark = hexPercent(backgroundBlack, 30);
const orangeAccent = "#ff8541";

const dark25 = "#525252";
const dark45 = "#666666";
const dark60 = "#ababab";

const txt = "#ffffff";
const txtLow = "rgba(255,255,255,0.38)";

const primary = "#23a2ee";
const blueAccent = "#085d8c";
const accent = "#ff2e2e";

export function darkTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "dark",
        label: "Default dark",
        burst: true,
        logo: true,
        mode: "dark",

        bg: backgroundBlack,
        txt: txt,
        "txt-light": textBodyDark,
        bd: borderDark,
        rd: "4px",
        bw: "1px",
        error: "#CF6679",
        warn: "#f36D28",
        accent: accent,
        disabledTxt: txtLow,
        primary,
        code: {
            bg: "rgba(0,0,0,0.7)",
            txt: "#f36D28",
        },
        font: '"Roboto", sans-serif',
        "font-bold": '"Manrope", sans-serif',

        unread: {
            mute: "rgba(255,255,255,0.2)",
            "mute-solid": "#555",
            "mute-txt": txt,
        },

        progress: {
            bd: "rgba(255,255,255,0.2)",
        },

        collapsible: {
            closed: {
                header: {
                    txt: textBodyDark,
                },
            },
            open: {
                header: {
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
            txt: txt,
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
        },

        "sub-section": {
            bg: dark25,
        },

        input: {
            bg: textBlack,
            sh: "inset 0px 2px 4px rgba(0,0,0,0.8)",
            accent: primary,
            bd: "none",
        },

        members: {
            ...defaultTheme.members,
            hv: hoveredChat,
        },

        entry: {
            bg: dark60pc,
            input: {
                bg: textBlack,
                sh: "inset 0px 2px 4px rgba(0, 0, 0, 0.8)",
                rd: "8px",
                bd: "none",
            },
        },

        panel: {
            ...defaultTheme.panel,
            bg: chatPanelDark,

            left: {
                bg: chatPanelDark,
            },

            nav: {
                bg: backgroundBlack,
            },

            right: {
                bg: chatPanelDark,
                modal: backgroundBlack,
            },
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            sh: "none",
            rd: "50%",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            bg: textBlack,
            sh: "inset 0px 2px 4px rgba(0, 0, 0, 0.8)",
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            "bg-selected": selectedChat,
            hv: hoveredChat,
            del: "#085d8c",
        },

        menu: {
            bg: backgroundBlack,
            txt: textBodyDark,
            warn: "#FF2E2E",
            "disabled-txt": txtLow,
            hv: hoveredChat,
            sh: "none",
            "inverted-sh": "0px -10px 10px 0px rgba(8,93,140,0.3)",
            bd: textBodyLight,
            separator: "rgba(255,255,255,0.2)",
        },

        button: {
            bg: blueAccent,
            hv: "#053d5c",
            "hv-txt": txt,
            txt: txt,
            "txt-sh": "none",
            disabled: textBodyLight,
            spinner: dark60,
            "disabled-txt": txtLow,
            "disabled-bd": "transparent",
            rd: "4px",
            sh: "none",
            "hv-sh": "none",
        },

        modal: {
            filter: "blur(5px)",
            bg: backgroundBlack,
            bd: `1px solid ${borderDark}`,
            rd: "16px",
            sh: "none",
        },

        modalPage: {
            bg: "rgba(0, 0, 0, 0.4)",
            txt: txt,
            sh: "none",
            filter: "blur(10px)",
            "txt-sh": "1px 1px rgba(0, 0, 0, 0.2)",
        },

        replies: {
            bd: "var(--bd);",
        },

        currentChat: {
            ...defaultTheme.currentChat,
            msgs: {
                bg: "transparent",
            },

            date: {
                bg: textBlack,
                txt: "inherit",
                bd: "none",
            },

            msg: {
                bg: textBlack,
                muted: txtLow,
                txt: "rgba(255,255,255,0.8)",
                inert: textBlack,
                bd: "none",
                sh: "none",
                r1: "8px",
                r2: "4px",
                separator: "rgba(255,255,255,0.2)",

                me: {
                    bg: blueAccent,
                    muted: "rgba(255,255,255,0.5)",
                    txt: "rgba(255,255,255,0.8)",
                    bd: "rgba(255,255,255,0.2)",
                    separator: "rgba(255,255,255,0.2)",
                },
            },
        },

        time: {
            txt: "#ffffff",
            icon: "#ffffff",
            bg: "rgba(255,255,255,0.2)",
            me: {
                txt: "#ffffff",
                icon: "#ffffff",
                bg: "rgba(255,255,255,0.2)",
            },
        },

        icon: {
            hv: "rgba(255,255,255,0.1)",
            txt: textBodyDark,
            selected: primary,
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
            bg: selectedChat,
        },

        toggle: {
            bg: dark45,
            rd: {
                track: "18px",
                thumb: "50%",
            },
        },

        thread: {
            preview: {
                bg: "transparent",
            },
        },

        vote: {
            ...defaultTheme.vote,
            maybe: {
                color: "#666666",
            },
        },

        markdown: {
            fg: {
                color: txt,
                bright: txt,
            },
        },

        card: {
            rd: "8px",
            sh: "none",
        },

        nav: {
            icon: {
                rd: "50%",
            },
        },

        audio: {
            outer: primary,
            inner: accent,
            note: txt,
            me: {
                outer: primary,
                inner: accent,
                note: txt,
            },
        },

        landing: {
            txt,
            "txt-light": textBodyDark,
            bg: backgroundBlack,
            bd: borderDark,

            context: {
                bg: "#2f3039",
            },

            phone: {
                bd: "#ffffffdd",
            },

            brag: {
                op: "0.7",
            },

            launch: {
                bg: primary,
            },

            header: {
                bg: backgroundBlack,
                txt: textBodyDark,
                bd: "1px solid rgba(255,255,255,0.2)",
            },

            auth: {
                bg: "rgba(0,0,0,0.6)",
                txt: textBodyDark,
            },

            roadmap: {
                bd: "#32353F",
            },
        },
        daily: {
            header: backgroundBlack,
            accent: "#ff2e2e",
            accentText: textBlack,
            background: backgroundBlack,
            backgroundAccent: "#292930",
            baseText: txt,
            border: borderDark,
            mainAreaBg: backgroundBlack,
            mainAreaBgAccent: "#292930",
            mainAreaText: txt,
            supportiveText: textBodyDark,
        },
    };
}
