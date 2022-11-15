import type { Theme } from "./themes";

const lightBorder = "#ededed";
const orangeAccent = "#ff9505";
const pinkAccent = "hotpink";
const blueAccent = "#22A7F2";
const disabledTxt = "#999999";
const primary = "#23a2ee";

export function lightTheme(): Theme {
    return {
        name: "light",
        label: "Light",

        bg: "linear-gradient(#22A7F2, #5f2583)",
        txt: "#191919",
        bd: "#dddddd",
        error: "#CF6679",
        accent: pinkAccent,
        accentDarker: "rgba(150, 50, 50, 0.8)",
        disabledTxt: disabledTxt,
        placeholder: "#aaaaaa",
        primary,

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
            txt: "rgba(255,255,255,0.9)",
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
            bg: "white",
            txt: "#191919",
        },

        "sub-section": {
            bg: "#ffffff",
        },

        input: {
            bg: "#ffffff",
            txt: "#191919",
        },

        members: {
            hv: "#eeeeee",
        },

        entry: {
            bg: "#efefef",
            input: {
                bg: "#ffffff",
                txt: "#191919",
            },
        },

        panel: {
            bg: "linear-gradient(#22A7F2, #5f2583)",
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            sh: "2px 2px 4px #e2e2e2",
        },

        chatSearch: {
            bg: "#ffffff",
            txt: "#555555",

            section: {
                txt: "#ffffff",
            },
        },

        chatSummary: {
            "bg-selected": "#e7e7e7",
            hv: "#eeeeee",
            txt1: "#191919",
            txt2: "rgba(0, 0, 0, 0.6)",
            del: pinkAccent,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: "#191919",
            "disabled-txt": disabledTxt,
            // bd: "#cccccc",
            hv: "#efefef",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(85, 85, 85, 0.3)",
        },

        button: {
            bg: primary,
            hv: "#52baf5",
            txt: "#ffffff",
            disabled: "#cccccc",
            spinner: "#ffffff",
            "disabled-txt": disabledTxt,
            "disabled-bd": "transparent",
        },

        link: {
            underline: "#22A7F2",
        },

        modal: {
            filter: "blur(5px)",
        },

        modalPage: {
            bg: "rgba(255, 255, 255, 0.5)",
            txt: "#191919",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
            filter: "blur(10px)",
            "txt-sh": "1px 1px rgba(255, 255, 255, 0.2)",
        },

        currentChat: {
            header: {
                // bg: "#efefef",
                txt: "#191919",
            },

            date: {
                bg: "rgba(255,255,255,0.7)",
                txt: "inherit",
            },

            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: "#ffffff",
                txt: "#191919",
                hv: "#efefef",
                muted: "#999999",

                me: {
                    bg: primary,
                    muted: "#cccccc",
                },
            },
        },

        icon: {
            // hv: "#dddddd",
            hv: "rgba(0,0,0,0.1)",
            txt: "#888",
            inverted: {
                hv: "rgba(214,44,125,0.5)",
            },
            msg: {
                hv: "rgba(255,255,255,0.8)",
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
                bg: "rgba(255, 255, 255, 0.05)",
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
