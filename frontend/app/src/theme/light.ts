import { hexPercent } from "./themes";
import type { Theme } from "./types";

const orangeAccent = "#ff9505";
const pinkAccent = "#ff005c";
const blueAccent = "#22A7F2";
const primary = "#23a2ee";
const textBox = "rgba(0,0,0,0.1)";
const txt = "#ffffff";
const txtLight = hexPercent("#ffffff", 67);
const txtDark = "#242834";
const txtDark75pc = hexPercent(txtDark, 75);
const disabledTxt = txtLight;

export function lightTheme(): Theme {
    return {
        name: "light",
        label: "Light",
        burst: false,
        mode: "light",
        warn: "#f36D28",

        bg: "linear-gradient(#22A7F2, #5f2583)",
        // bg: "#ffffff",
        txt,
        "txt-light": txtLight,
        bd: "rgba(255,255,255,0.1)",
        error: "#CF6679",
        accent: pinkAccent,
        accentDarker: "rgba(150, 50, 50, 0.8)",
        disabledTxt: txtLight,
        placeholder: txtLight,
        primary,

        progress: {
            bd: "rgba(255,255,255,0.2)",
        },

        collapsible: {
            closed: {
                header: {
                    txt: txtLight,
                },
            },
            open: {
                header: {
                    arrow: pinkAccent,
                },
            },
        },

        notificationBar: {
            bg: orangeAccent,
            txt: "#ffffff",
        },

        reaction: {
            bg: "#efefef",
            txt: txtDark,
            me: blueAccent,
        },

        timeline: {
            txt: txtLight,
            bg: "transparent",
        },

        toast: {
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
            bg: "#ffffff",
        },

        input: {
            bg: textBox,
            sh: "none",
        },

        members: {
            hv: "rgba(226,226,226,0.2)",
        },

        entry: {
            bg: "rgba(226,226,226,0.1)",
            input: {
                bg: textBox,
                sh: "none",
            },
        },

        panel: {
            bg: "linear-gradient(#22A7F2, #5f2583)",

            left: {
                bg: `linear-gradient(${hexPercent("#22A7F2", 31.3)}, ${hexPercent(
                    "#5f2583",
                    31.3
                )})`,
            },

            right: {
                bg: "linear-gradient(rgba(255,255,255,0.1), transparent)",
                modal: "linear-gradient(#22A7F2, #5f2583)",
            },
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            sh: "2px 2px 4px #e2e2e2",
        },

        chatSearch: {
            bg: textBox,
            sh: "none",
        },

        chatSummary: {
            "bg-selected": "rgba(0,0,0,0.1)",
            hv: "rgba(226,226,226,0.1)",
            del: pinkAccent,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: txtDark75pc,
            warn: "#FF2E2E",
            "disabled-txt": hexPercent(txtDark, 50),
            hv: "rgba(226,226,226,0.5)",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(85, 85, 85, 0.3)",
            bd: "transparent",
        },

        button: {
            bg: primary,
            hv: "#52baf5",
            txt: txt,
            disabled: "rgba(0,0,0,0.1)",
            spinner: "#ffffff",
            "disabled-txt": disabledTxt,
            "disabled-bd": "transparent",
        },

        link: {
            underline: "#22A7F2",
        },

        modal: {
            filter: "blur(5px)",
            bg: hexPercent("#085d8c", 93),
            bd: "none",
        },

        modalPage: {
            bg: "rgba(255, 255, 255, 0.5)",
            txt: "#191919",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
            filter: "blur(10px)",
            "txt-sh": "1px 1px rgba(255, 255, 255, 0.2)",
        },

        currentChat: {
            date: {
                bg: "rgba(0,0,0,0.1)",
                txt: "inherit",
            },

            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: "rgba(0,0,0,0.08)",
                muted: "rgba(255,255,255,0.6)",
                txt: "#ffffff",
                inert: "rgba(0,0,0,0.1)",

                me: {
                    bg: hexPercent(primary, 50),
                    muted: "rgba(255,255,255,0.6)",
                    txt: "#ffffff",
                    bd: "rgba(255,255,255,0.3)",
                },
            },
        },

        icon: {
            hv: "rgba(0,0,0,0.1)",
            txt,
            selected: orangeAccent,
            inverted: {
                hv: "rgba(0,0,0,0.1)",
                txt: txtDark75pc,
            },
            msg: {
                hv: "rgba(255,255,255,0.3)",
            },
        },

        scrollbar: {
            bg: "rgba(34, 167, 242, 0.4)",
        },

        findUser: {
            edit: {
                pill: {
                    txt: "#fff",
                },
            },
            add: {
                pill: {
                    txt: "#fff",
                },
            },
        },

        recommended: {
            bg: "rgba(0,0,0,0.08)",
        },

        toggle: {
            bg: "#cccccc",
        },

        thread: {
            preview: {
                bg: "transparent",
            },
        },

        vote: {
            yes: {
                color: "#4ae97a",
                hv: "#0d8cd4",
            },
            no: {
                color: "#ff2e2e",
                hv: "#ff4fa7",
            },
            maybe: {
                color: "#aaaaaa",
            },
        },

        markdown: {
            fg: {
                color: txt,
                bright: txt,
                muted: txtLight,
            },
        },

        landing: {
            txt: txtDark,
            "txt-light": "#5C5C5C",
            bg: "white",
            bd: "#ededed",

            brag: {
                op: "0.3",
            },

            context: {
                bg: "#ffffff",
            },

            phone: {
                bd: "#ffffff",
            },

            launch: {
                bg: primary,
            },

            header: {
                bg: "#ffffff",
                txt: txtDark,
                bd: "none",
            },

            auth: {
                bg: "rgba(255,255,255,0.9)",
                txt: "#191919",
            },

            roadmap: {
                bd: "#E2E2E2",
            },
        },
    };
}
