import createMuiTheme, { Theme, ThemeOptions } from "@material-ui/core/styles/createMuiTheme";

interface CustomColors {
    linkColor: string,
    outerBackgroundColor: string,
    mainPanel: {
        backgroundColor: string
    },
    header: {
        primaryTextColor: string,
        secondaryTextColor: string,
        backgroundColor: string
    },
    footer: {
        iconColor: string,
        backgroundColor: string
    },
    sidePanel: {
        textColor: string,
        backgroundColor: string,
        subHeaderBackgroundColor: string,
        listItemHoverBackgroundColor: string,
        listItemSelectedBackgroundColor: string
    },
    textBox: {
        backgroundColor: string,
        textColor: string
    },
    messageSentByMe: {
        textColor: string,
        backgroundColor: string,
        altBackgroundColor: string
    },
    messageSentByElse: {
        textColor: string,
        backgroundColor: string,
        altBackgroundColor: string
    }
    dayChangeMarker: {
        textColor: string,
        backgroundColor: string
    },
    icon: {
        color: string,
        backgroundColor: string
    },
    green: {
        main: string,
        contrastText: string
    },
    loginRegister: {
        textColor: string,
        backgroundColor: string,
        buttonBackgroundColor: string,
        buttonTextColor: string
    }
}

interface ThemeExtensions {
    avatarSize: {
        sm: number,
        md: number
    },
    colors: CustomColors
}

declare module "@material-ui/core/styles/createMuiTheme" {
    export interface Theme extends ThemeExtensions { }
    export interface ThemeOptions extends ThemeExtensions { }
}

declare module "@material-ui/core/styles" {
    interface TypographyVariants {
        smallest: React.CSSProperties;
    }

    interface TypographyVariantsOptions {
        smallest?: React.CSSProperties;
    }
}

declare module "@material-ui/core/Typography" {
    interface TypographyPropsVariantOverrides {
        smallest: true;
    }
}

const defaultColours: CustomColors = {
    linkColor: "#d62c7d",
    outerBackgroundColor: "#41398b",
    mainPanel: {
        backgroundColor: "#3dc5ee"
    },
    header: {
        primaryTextColor: "#000000",
        secondaryTextColor: "#666666",
        backgroundColor: "#ededed"
    },
    footer: {
        iconColor: "#9b9b9b",
        backgroundColor: "#ededed"
    },
    sidePanel: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        subHeaderBackgroundColor: "#f6f6f6",
        listItemHoverBackgroundColor: "#f0f0f0",
        listItemSelectedBackgroundColor: "#eeeeee"
    },
    textBox: {
        backgroundColor: "#ffffff",
        textColor: "#111111"
    },
    messageSentByMe: {
        textColor: "#ffffff",
        backgroundColor: "#d62c7d",
        altBackgroundColor: "#ea4091"
    },
    messageSentByElse: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        altBackgroundColor: "#e9e9e9"
    },
    dayChangeMarker: {
        textColor: "#000000",
        backgroundColor: "#dddddd"
    },
    icon: {
        color: "#ffffff",
        backgroundColor: "#d8d8d8"
    },
    green: {
        main: "#32cd32",
        contrastText: "#ffffff"
    },
    loginRegister: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        buttonBackgroundColor: "#3dc5ee",
        buttonTextColor: "#ffffff"
    }
};

// const darkThemeColors: CustomColors = {
//     outerBackgroundColor: "#201c45",
//     mainPanelBackgroundColor: "#042b36",
//     sidePanelBackgroundColor: "#111111",
//     headerBackgroundColor: "#383838",
//     subHeaderBackgroundColor: "#484848",
//     dayChangeMarker: {
//         color: "#111111",
//         backgroundColor: "#aaaaaa"
//     },
//     listItemBackgroundColor: {
//         main: "#111111",
//         hover: "#222222",
//         selected: "#333333"
//     },
//     textColor: "#cccccc",
//     icon: {
//         color: "#777777",
//         backgroundColor: "#222222"
//     },
//     messageSentByMe: {
//         color: "#dddddd",
//         backgroundColor: "#444444"
//     },
//     messageSentByElse: {
//         color: "#888888",
//         backgroundColor: "#111111"
//     },
//     menuColor: "#111111",
//     green: {
//         main: "#28a428",
//         contrast: "#cccccc"
//     }
// }

const buildOptions = (colors: CustomColors) : ThemeOptions => ({
    typography: {
        fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\"",
        h6: {
            fontWeight: "normal"
        },
        smallest: {
            fontSize: "0.6875rem"
        }
    },
    components: {
        MuiButtonBase: {
            defaultProps: {
                disableRipple: true
            }
        },
        MuiLink: {
            defaultProps: {
                color: colors.linkColor
            }
        },
        MuiTypography: {
            defaultProps: {
                variantMapping: {
                    body1: "span",
                    body2: "span",
                    caption: "span"
                }
            }
        }
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 960,
            lg: 1400,
            xl: 1920
        }
    },
    avatarSize: {
        sm: 40,
        md: 50
    },
    colors: colors
});

const createDefaultTheme = () : Theme => createTheme(defaultColours);
const createTheme = (customColors: CustomColors) : Theme => createMuiTheme(buildOptions(customColors));

export const lightTheme = createDefaultTheme();
export const darkTheme = createTheme(defaultColours);
