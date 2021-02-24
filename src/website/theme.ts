import { createMuiTheme } from "@material-ui/core";

export type AvatarOptions = {
    size: number,
    userOnlineMarkerSize: number
}

declare module '@material-ui/core/styles/createMuiTheme' {
    interface Theme {
        avatars: {
            sm: AvatarOptions,
            md: AvatarOptions
        },
        header: {
            height: number,
            flexShrink: number,
            backgroundColor: string,
            padding: string
        },
        selectableListItem: {
            "&:hover": {
                backgroundColor: string,
                cursor: string
            }
        }
    }
    interface ThemeOptions {
        avatars: {
            sm: AvatarOptions,
            md: AvatarOptions
        },
        header: {
            height: number,
            flexShrink: number,
            backgroundColor: string,
            padding: string
        },
        selectableListItem: {
            "&:hover": {
                backgroundColor: string,
                cursor: string
            }
        }
    }
}

const theme = createMuiTheme({
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
    avatars: {
        sm: {
            size: 40,
            userOnlineMarkerSize: 10
        },
        md: {
            size: 50,
            userOnlineMarkerSize: 12
        }
    },
    header: {
        height: 52,
        flexShrink: 0,
        backgroundColor: "#ededed",
        padding: "0 15px"
    },
    selectableListItem: {
        "&:hover": {
            backgroundColor: "#f0f0f0",
            cursor: "pointer"
        }
    },
    palette: {
        primary: {
            main: "#ffffff"
        },
        secondary: {
            main: "#d62c7d"
        },
        text: {
            primary: "#000000",
            secondary: "#ffffff"
        }
    }
});

export default theme;
