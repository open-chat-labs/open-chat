import { createMuiTheme, Theme, ThemeOptions } from "@material-ui/core";

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
    green: string
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

declare module '@material-ui/core/styles/createMuiTheme' {
    export interface Theme extends ThemeExtensions { }
    export interface ThemeOptions extends ThemeExtensions { }
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
    green: "#32cd32"
};

const defaultOptions: ThemeOptions = {
    typography: {
        fontFamily: "-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\""
    },
    overrides: {
        MuiTypography: {
            h6: {
                fontWeight: "normal"
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
    props: {
        MuiButtonBase: {
            disableRipple: true
        },
        MuiTypography: {
            variantMapping: {
                body1: "span",
                body2: "span",
                caption: "span"
            }
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
