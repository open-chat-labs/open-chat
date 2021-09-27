import createMuiTheme, { ThemeOptions } from "@material-ui/core/styles/createMuiTheme";
import { darken, lighten } from "@material-ui/core/styles/colorManipulator";

interface CustomColors {
    outerBackgroundColor: string,
    textColor: string,
    mainPanel: {
        backgroundColor: string
    },
    header: {
        primaryTextColor: string,
        secondaryTextColor: string,
        backgroundColor: string
    },
    footer: {
        mutedColor: string,
        iconColor: string,
        backgroundColor: string
    },
    sidePanel: {
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
        highlightedContentBackgroundColor: string
    },
    messageSentByElse: {
        textColor: string,
        backgroundColor: string,
        highlightedContentBackgroundColor: string,
        unreadMessageBrightness: number
    }
    dayChangeMarker: {
        textColor: string,
        backgroundColor: string
    },
    linkColor: string,
    buttonColor: string,
    icon: {
        color: string,
        hover: string,
        backgroundColor: string
    },
    iconAlt: {
        color: string,
        hover: string,
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
    outerBackgroundColor: "#41398b",
    textColor: "#000000",
    mainPanel: {
        backgroundColor: "#3dc5ee"
    },
    header: {
        primaryTextColor: "#000000",
        secondaryTextColor: "#666666",
        backgroundColor: "#ededed"
    },
    footer: {
        mutedColor: "#444444",
        iconColor: "#9b9b9b",
        backgroundColor: "#ededed"
    },
    sidePanel: {
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
        highlightedContentBackgroundColor: "#ea4091"
    },
    messageSentByElse: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        highlightedContentBackgroundColor: "#e9e9e9",
        unreadMessageBrightness: 0.90
    },
    dayChangeMarker: {
        textColor: "#000000",
        backgroundColor: "#dddddd"
    },
    linkColor: "#d62c7d",
    buttonColor: "#d62c7d",
    icon: {
        color: "#ffffff",
        hover: "rgba(0, 0, 0, 0.08)",
        backgroundColor: "#d8d8d8"
    },
    iconAlt: {
        color: "#333333",
        hover: darken("#d8d8d8", 0.1),
        backgroundColor: "#d8d8d8"
    },
    green: {
        main: "#32cd32",
        contrastText: "#ffffff"
    },
    loginRegister: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        buttonBackgroundColor: "#269fd4",
        buttonTextColor: "#ffffff"
    }
};

const darkThemeColors: CustomColors = {
    outerBackgroundColor: "#000000",
    textColor: "#bbbbbb",
    mainPanel: {
        backgroundColor: "#111111"
    },
    header: {
        primaryTextColor: "#cccccc",
        secondaryTextColor: "#a8a8a8",
        backgroundColor: "#333333"
    },
    footer: {
        mutedColor: "#bbbbbb",
        iconColor: "#aaaaaa",
        backgroundColor: "#333333"
    },
    sidePanel: {
        backgroundColor: "#222222",
        subHeaderBackgroundColor: "#383838",
        listItemHoverBackgroundColor: "#383838",
        listItemSelectedBackgroundColor: "#444444"
    },
    textBox: {
        backgroundColor: "#555555",
        textColor: "#cccccc"
    },
    messageSentByMe: {
        textColor: "#cccccc",
        backgroundColor: "#961f57",
        highlightedContentBackgroundColor: "#c12871"
    },
    messageSentByElse: {
        textColor: "#bbbbbb",
        backgroundColor: "#383838",
        highlightedContentBackgroundColor: "#494949",
        unreadMessageBrightness: 1.05
    },
    dayChangeMarker: {
        textColor: "#444444",
        backgroundColor: "#aaaaaa"
    },
    linkColor: "#d62c7d",
    buttonColor: "#d62c7d",
    icon: {
        color: "#777777",
        hover: "rgba(255, 255, 255, 0.08)",
        backgroundColor: "#222222"
    },
    iconAlt: {
        color: "#777777",
        hover: lighten("#222222", 0.1),
        backgroundColor: "#222222"
    },
    green: {
        main: "#28a428",
        contrastText: "#cccccc"
    },
    loginRegister: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
        buttonBackgroundColor: "#3dc5ee",
        buttonTextColor: "#ffffff"
    }
}

const buildOptions = (darkMode: boolean) : ThemeOptions => {
    const colors = darkMode ? darkThemeColors : defaultColours;

    return {
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
                sm: 768,
                md: 960,
                lg: 1400,
                xl: 1920
            }
        },
        avatarSize: {
            sm: 40,
            md: 50
        },
        colors: darkMode ? darkThemeColors : defaultColours,
        palette: {
            mode: darkMode ? "dark" : "light"
        }
    };
}

export const lightTheme = createMuiTheme(buildOptions(false));
export const darkTheme = createMuiTheme(buildOptions(true));
