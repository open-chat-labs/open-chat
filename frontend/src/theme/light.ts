import type { Theme } from "./themes";

const sp3 = "8px";

const orangeAccent = "#ff9505";
const pinkAccent = "hotpink";
const blueAccent = "#22A7F2";

export function lightTheme(): Theme {
    return {
        name: "light",
        label: "Light",

        mg: "8px auto",
        bg: "linear-gradient(#22A7F2, #5f2583)",
        txt: "#191919",
        error: "#CF6679",
        accent: pinkAccent,
        accentDarker: "rgba(150, 50, 50, 0.8)",
        placeholder: "#aaaaaa",

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
            bd: "transparent",
            "bd-start": "transparent",
        },

        "sub-section": {
            bg: "#ffffff",
        },

        input: {
            bg: "#ffffff",
            txt: "#191919",
            bd: "#dddddd",
        },

        participants: {
            bg: "#efefef",
            txt: "#191919",
            hv: "#e2e2e2",
            bd: "transparent",
            bdb: "transparent",
            mg: "0 8px 8px 8px",
            search: {
                pd: "0 8px",
            },
            panel: {
                // bg: "#fff",
                bg: "transparent",
            },
        },

        entry: {
            bg: "#efefef",
            bd: "#dddddd",
            input: {
                bg: "#ffffff",
                txt: "#191919",
            },
        },

        panel: {
            bg: "linear-gradient(#22A7F2, #5f2583)",
            left: {
                bg: "linear-gradient(transparent, rgba(255,255,255,0.15))",
                xs: "transparent",
            },
            right: {
                bg: "linear-gradient(#22A7F2, #5f2583)",
            },
        },

        currentUser: {
            bd: "transparent",
            bg: "white",
            txt: "#191919",
            ic: "#aaa",
        },

        avatar: {
            bg: "rgba(255, 255, 255,25%)",
            bd: "#cccccc",
            sh: "2px 2px 4px #e2e2e2",
        },

        chatSearch: {
            bg: "#ffffff",
            txt: "#555555",
            mg: "0",
            pd: "4px 16px",
            bd: "transparent",

            section: {
                txt: "#ffffff",
                title: {
                    ml: "0",
                },
            },

            xs: {
                pd: "0 8px",
                mg: "0 8px",
            },
        },

        chatSummary: {
            bg: "white",
            "bg-selected": "#e7e7e7",
            hv: "#eeeeee",
            txt1: "#191919",
            txt2: "rgba(0, 0, 0, 0.6)",
            bd: "1px solid #ddd",
            mb: "0",
            del: pinkAccent,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: "#191919",
            "disabled-txt": "#999999",
            // bd: "#cccccc",
            bd: "rgba(0,0,0,0.05)",
            hv: "#efefef",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.3)",
            "inverted-sh": "0px -10px 10px 0px rgba(85, 85, 85, 0.3)",
        },

        button: {
            bg: blueAccent,
            hv: "#52baf5",
            txt: "#ffffff",
            bd: "transparent",
            disabled: "#cccccc",
            spinner: "#ffffff",
            "disabled-txt": "#999999",
            "disabled-bd": "transparent",
        },

        link: {
            underline: "#22A7F2",
        },

        modal: {
            bg: "#ffffff",
            txt: "#191919",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
            filter: "blur(5px)",
            header: {
                bg: "#ffffff",
                txt: "#191919",
                bd: "#dfdfdf",
            },
            footer: {
                bg: "#efefef",
                txt: "#191919",
                bd: "#dddddd",
            },
        },

        modalPage: {
            bg: "rgba(255, 255, 255, 0.5)",
            txt: "#191919",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
            filter: "blur(10px)",
            bd: "1px inset rgba(255, 255, 255, 0.3)",
            "txt-sh": "1px 1px rgba(255, 255, 255, 0.2)",
        },

        currentChat: {
            header: {
                // bg: "#efefef",
                bg: "rgba(255,255,255,0.35)",
                txt: "#191919",
                bd: "transparent",
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
                bd: "transparent",
                "reply-accent": blueAccent,

                me: {
                    // bg: "#ff69b4",
                    // hv: "#ff4fa7",
                    // bd: "#ff69b4",

                    txt: "#ffffff",
                    bg: "#d62c7d",
                    bd: "#d62c7d",
                    hv: "#EA4091",
                },
            },
        },

        icon: {
            color: "#cccccc",
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

        groupForm: {
            add: {
                pd: "0",
            },
            edit: {
                pd: "8px",
            },
        },

        findUser: {
            mg: "0 0 8px 0",
            edit: {
                wrapper: {
                    mg: "0 8px",
                },
                search: {
                    mg: "0 0 8px 0",
                },
                selected: {
                    mg: "0",
                },
                pill: {
                    txt: "#fff",
                },
            },
            add: {
                pd: "0",
                pdxs: "8px",
                search: {
                    mg: "0 0 8px 0",
                },
                pill: {
                    txt: "#191919",
                },
            },
        },

        recommended: {
            bg: "#ffffff",
        },

        profile: {
            section: {
                mg: "8px",
                bd: "none",
                bg: "#fff",
                xs: {
                    mg: "0",
                    bd: "1px solid #eaeaea",
                },
            },
        },

        collapsible: {
            header: {
                bg: "#f6f6f6",
                bd: "1px solid #eaeaea",
            },
            bg: "#fff",
        },

        toggle: {
            bg: "#cccccc",
        },
    };
}
