import createMuiTheme, { Theme, ThemeOptions } from "@material-ui/core/styles/createMuiTheme";

interface CustomColors {
    outerBackgroundColor: string,
    mainPanelBackgroundColor: string,
    sidePanelBackgroundColor: string,
    headerBackgroundColor: string,
    textColor: string,
    icon: {
        color: string,
        backgroundColor: string
    },
    messageSentByMe: {
        color: string,
        backgroundColor: string
    },
    messageSentByElse: {
        color: string,
        backgroundColor: string
    },
    menuColor: string,
    green: {
        main: string,
        contrast: string
    }
}

interface ThemeExtensions {
    avatarSize: {
        sm: number,
        md: number
    },
    selectableListItem: {
        "&:hover": {
            backgroundColor: string,
            cursor: string
        }
    },
    customColors: CustomColors
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
    mainPanelBackgroundColor: "#3dc5ee",
    sidePanelBackgroundColor: "#ffffff",
    headerBackgroundColor: "#ededed",
    textColor: "#000000",
    icon: {
        color: "#ffffff",
        backgroundColor: "#d8d8d8"
    },
    messageSentByMe: {
        color: "#ffffff",
        backgroundColor: "#d62c7d"
    },
    messageSentByElse: {
        color: "#000000",
        backgroundColor: "#ffffff"
    },
    menuColor: "#ffffff",
    green: {
        main: "#32cd32",
        contrast: "#ffffff"
    }
};

const defaultOptions: ThemeOptions = {
    typography: {
        fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\"",
        h6: {
            fontWeight: "normal"
        },
        smallest: {
            fontSize: "0.688rem"
        }
    },
    components: {
        MuiButtonBase: {
            defaultProps: {
                disableRipple: true
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
    selectableListItem: {
        "&:hover": {
            backgroundColor: "#f0f0f0",
            cursor: "pointer"
        }
    },
    customColors: defaultColours
}

function createDefaultTheme() : Theme {
    return createMuiTheme(defaultOptions);
}

function createTheme(customColors: CustomColors) : Theme {
    const options: ThemeOptions = {
        ...defaultOptions,
        customColors
    };

    return createMuiTheme(options);
}

export const lightTheme = createDefaultTheme();
export const darkTheme = createTheme({
    ...defaultColours,
    sidePanelBackgroundColor: "#000000"
});
