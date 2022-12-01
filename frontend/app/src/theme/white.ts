import { hexPercent, Theme } from "./themes";

const orangeAccent = "#ff9505";
// const pinkAccent = "hotpink";
const pinkAccent = "#ff005c";
const blueAccent = "#22A7F2";
const primary = "#23a2ee";
const textBox = "rgba(226,226,226,0.5)";
const txt = "#242834";
const txt70 = hexPercent(txt, 70);
const txt60 = hexPercent(txt, 60);
const txtDark = "#242834";
const disabledTxt = txt70;

export function whiteTheme(): Theme {
    return {
        name: "white",
        label: "White",
        bg: "#ffffff",
        txt,
        "txt-light": txt70,
        bd: "#ededed",
        error: "#CF6679",
        accent: pinkAccent,
        accentDarker: "rgba(150, 50, 50, 0.8)",
        disabledTxt: txt70,
        placeholder: txt60,
        primary,

        progress: {
            bd: "rgba(0,0,0,0.2)",
        },

        collapsible: {
            closed: {
                header: {
                    txt: txt70,
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
            me: pinkAccent,
        },

        timeline: {
            txt: txt70,
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
                //bg: textBox,
                bg: "#ffffff",
                // sh: "none",
                sh: "inset 0px 2px 4px rgba(138, 138, 138, 0.5)",
            },
        },

        panel: {
            bg: "transparent",

            left: {
                bg: "transparent",
            },

            right: {
                bg: "transparent",
                modal: "#ffffff",
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
            "bg-selected": "rgba(226,226,226,0.5)",
            hv: "rgba(226,226,226,0.1)",
            del: pinkAccent,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: txt70,
            "disabled-txt": hexPercent(txtDark, 50),
            hv: "rgba(226,226,226,0.5)",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(85, 85, 85, 0.3)",
            bd: "transparent",
        },

        button: {
            bg: primary,
            hv: "#52baf5",
            txt: "#ffffff",
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
            bg: "#ffffff",
            bd: "none",
        },

        modalPage: {
            bg: "rgba(255, 255, 255, 0.5)",
            txt,
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
                bg: "rgba(226,226,226,0.5)",
                muted: "rgba(255,255,255,0.6)",
                txt: txt70,
                inert: "rgba(226,226,226,0.8)",

                me: {
                    bg: primary,
                    muted: "rgba(255,255,255,0.6)",
                    txt: "#ffffff",
                    bd: "rgba(0,0,0,0.05)",
                },
            },
        },

        icon: {
            hv: "rgba(0,0,0,0.1)",
            txt: txt60,
            inverted: {
                hv: "rgba(0,0,0,0.1)",
                txt: txt60,
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
            bg: "#ffffff",
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
                color: blueAccent,
                hv: "#0d8cd4",
            },
            no: {
                color: pinkAccent,
                hv: "#ff4fa7",
            },
            maybe: {
                color: "#666666",
            },
        },

        markdown: {
            fg: {
                color: txt,
                bright: txt,
                muted: txt70,
            },
        },

        landing: {
            txt: txtDark,
            "txt-light": "#5C5C5C",
            bg: "white",

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
