import type { Theme } from "./themes";

const sp3 = "8px";

export function lightTheme(): Theme {
    return {
        name: "light",
        label: "Light",

        mg: "0 auto",
        bg: "linear-gradient(#22A7F2, #5f2583)",
        txt: "#191919",
        error: "#CF6679",
        accent: "hotpink",

        notificationBar: {
            bg: "#f79031",
            txt: "#ffffff",
        },

        reaction: {
            bg: "#efefef",
            txt: "#191919",
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
                bg: "limegreen",
                txt: "#ffffff",
            },
        },

        section: {
            bg: "white",
            txt: "#191919",
            bd: "transparent",
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
            pd: sp3,
            bg: "linear-gradient(#22A7F2, #5f2583)",
            left: {
                bg: "rgba(255,255,255,0.15)",
            },
            right: {
                bg: "transparent",
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
            bd: "#dddddd",
            mg: "0",

            section: {
                txt: "#ffffff",
            },
        },

        chatSummary: {
            bg: "white",
            hv: "#efefef",
            txt1: "#191919",
            txt2: "#777777",
            bd: "transparent",
            "bd-selected": "#f79031",
            mb: sp3,
        },

        spinner: "#ffffff",

        menu: {
            bg: "white",
            txt: "#191919",
            "disabled-txt": "#999999",
            bd: "#cccccc",
            hv: "#efefef",
            sh: "0px 13px 13px 0px rgba(85, 85, 85, 0.5)",
        },

        button: {
            bg: "#22A7F2",
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

            msgs: {
                bg: "transparent",
            },

            msg: {
                bg: "#ffffff",
                txt: "#191919",
                hv: "transparent",
                bd: "#cccccc",

                me: {
                    bg: "#ff69b4",
                    txt: "#ffffff",
                    hv: "#ff4fa7",
                    bd: "#ff69b4",
                },
            },
        },

        icon: {
            color: "#cccccc",
            hv: "#dddddd",
            txt: "#aaa",
        },

        scrollbar: {
            bg: "rgba(34, 167, 242, 0.4)",
        },
    };
}
