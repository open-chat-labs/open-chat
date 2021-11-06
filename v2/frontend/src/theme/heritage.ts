import type { Theme } from "./themes";

export function heritageTheme(defaultTheme: Theme): Theme {
    return {
        ...defaultTheme,
        name: "heritage",
        label: "Heritage",
        bg: "#41398b",
        mg: "20px auto",

        panel: {
            ...defaultTheme.panel,
            pd: "0",
            bg: "#3ec4ee",
            left: {
                ...defaultTheme.panel.left,
                bg: "#ffffff",
            },
            right: {
                ...defaultTheme.panel.right,
                bg: "#ffffff",
            },
        },

        chatSummary: {
            ...defaultTheme.chatSummary,
            mb: "0",
            bd: "1px solid #ddd",
            hv: "#efefef",
        },

        currentUser: {
            ...defaultTheme.currentUser,
            bd: "1px solid #ddd",
            bg: "#ededed",
        },

        chatSearch: {
            ...defaultTheme.chatSearch,
            mg: "0 8px",
            bg: "#ffffff",
        },

        button: {
            ...defaultTheme.button,
            bg: "#f79031",
            hv: "#52baf5",
            txt: "#ffffff",
            bd: "transparent",
            disabled: "#cccccc",
            spinner: "#ffffff",
            "disabled-txt": "#999999",
            "disabled-bd": "transparent",
        },

        section: {
            ...defaultTheme.section,
            bg: "#ededed",
        },

        icon: {
            ...defaultTheme.icon,
            txt: "#666",
        },

        scrollbar: {
            ...defaultTheme.scrollbar,
            bg: "rgba(255,255,255, 0.5)",
        },
    };
}
