import type { Theme } from "./themes";

const orangeAccent = "#ff9505";
const pinkAccent = "hotpink";
const blueAccent = "#22A7F2";
const primary = "#23a2ee";
const textBox = "rgba(0,0,0,0.1)";
const txt = "#ffffff";
const txtLight = "#ffffffaa";
const txtDark = "#242834";
const txtDark75pc = `${txtDark}bf`;
const disabledTxt = txtLight;

export function lightTheme(): Theme {
    return {
        name: "light",
        label: "Light",

        bg: "linear-gradient(#22A7F2, #5f2583)",
        // bg: "#ffffff",
        txt,
        "txt-light": txtLight,
        // bd: "#ededed",
        bd: "rgba(255,255,255,0.1)",
        error: "#CF6679",
        accent: pinkAccent,
        accentDarker: "rgba(150, 50, 50, 0.8)",
        disabledTxt: txtLight,
        placeholder: txtLight,
        primary,

        collapsible: {
            open: pinkAccent,
        },

        notificationBar: {
            bg: orangeAccent,
            txt: "#ffffff",
        },

        reaction: {
            bg: "#efefef",
            txt: "#191919",
            me: pinkAccent,
        },

        timeline: {
            txt: txtLight,
            bg: "transparent",
        },

        toast: {
            failure: {
                bg: "#c71f1f",
                txt: "#ffffff",
            },
            success: {
                bg: orangeAccent,
                txt: "#ffffff",
            },
        },

        section: {
            // bg: "#ffffff10",
            bg: "transparent",
            txt,
        },

        "sub-section": {
            bg: "#ffffff",
        },

        input: {
            bg: textBox,
            txt,
        },

        members: {
            hv: "rgba(226,226,226,0.2)",
        },

        entry: {
            bg: "rgba(226,226,226,0.1)",
            input: {
                bg: textBox,
                txt,
            },
        },

        panel: {
            bg: "linear-gradient(#22A7F2, #5f2583)",

            left: {
                // bg: "linear-gradient(rgba(255,255,255,0.1), transparent)",
                bg: "linear-gradient(rgba(255,255,255,0.05), transparent)",
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
            txt,

            section: {
                txt: "#ffffff",
            },
        },

        chatSummary: {
            "bg-selected": "rgba(0,0,0,0.05)",
            hv: "rgba(226,226,226,0.1)",
            txt1: txt,
            txt2: txtLight,
            del: pinkAccent,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: txtDark75pc,
            "disabled-txt": disabledTxt,
            hv: "rgba(226,226,226,0.5)",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(85, 85, 85, 0.3)",
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
            // bg: "linear-gradient(#22A7F2C8, #5f2583C8)",
            bg: "linear-gradient(#419ed3d8, #5c3375d8)",
            txt: txt,
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

                me: {
                    bg: `${primary}80`,
                    muted: "rgba(255,255,255,0.6)",
                },
            },
        },

        icon: {
            // hv: "#dddddd",
            hv: "rgba(0,0,0,0.1)",
            txt,
            inverted: {
                // hv: "rgba(214,44,125,0.5)",
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
            // bg: "#ffffff",
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
            // yes: "lightgreen",
            // no: "red",
            // yes: "#2fb953",
            // no: "#B92F2F",
        },

        markdown: {
            fg: {
                color: "#3a3a3a",
                bright: "#000",
                muted: "#777",
            },
            bg: {
                dark: "#eeeeee",
            },
        },
    };
}
