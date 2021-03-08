import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./reducers";
import { Provider } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import useTheme from "@material-ui/core/styles/useTheme";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import MuiThemeProvider from "@material-ui/core/styles/ThemeProvider";
import StyledEngineProvider from "@material-ui/styled-engine/StyledEngineProvider";
import Container from "@material-ui/core/Container";
import App from "./components/App";
import store from "./store";
import { lightTheme } from "./theme";
import CanisterClientFactory from "./services/CanisterClientFactory";
import authClient from "./utils/authClient";
import Login from "./components/Login";
import * as canisterFunctions from "./utils/canisterFunctions";
import { UserRegistrationStatus } from "./reducers/usersReducer";
import RegisterUser from "./components/RegisterUser";
import getCurrentUser from "./actions/users/getCurrentUser";

export default AppRoot;

const useStyles = makeStyles((theme: Theme) => ({
    "@global": {
        body: {
            height: "100vh",
            width: "100vw",
            backgroundColor: theme.colors.outerBackgroundColor,
            lineHeight: 1.5
        },
        header: {
            backgroundColor: theme.colors.header.backgroundColor,
            height: 52,
            flexShrink: 0,
            padding: "0 15px"
        },
        a: {
            color: theme.colors.linkColor
        }
    },
    container: {
        padding: 24,
        height: "100%",
        "&.no-padding": {
            padding: 0
        }
    }
}));

function AppRoot() {
    return (
        <Provider store={store}>
            <StyledEngineProvider injectFirst>
                <MuiThemeProvider theme={lightTheme}>
                    <AppContainer />
                </MuiThemeProvider>
            </StyledEngineProvider>
        </Provider>
    );
}

function AppContainer() {
    // If the url contains the authentication token then
    // 1. extract it and store it locally
    // 2. Remove the url fragment
    authClient.handleRedirectCallback(location);

    const identity = authClient.getIdentity();
    const isAnonymous = identity.getPrincipal().isAnonymous();
    const canisterIds = canisterFunctions.extractCanisterIds();
    CanisterClientFactory.current = new CanisterClientFactory(identity, canisterIds);

    const dispatch = useDispatch();
    const userRegistrationStatus = useSelector((state: RootState) => state.usersState.userRegistrationStatus);

    const classes = useStyles();
    const theme = useTheme();
    const removePadding = useMediaQuery(theme.breakpoints.down("md"));

    let containerClass = classes.container;
    if (removePadding) {
        containerClass += " no-padding";
    }

    let component;
    let large = false;

    if (isAnonymous) {
        component = <Login canisterIds={canisterIds} />;
    } else {
        switch (userRegistrationStatus) {
            case UserRegistrationStatus.Unknown:
                dispatch(getCurrentUser());
                component = null;
                break;
            case UserRegistrationStatus.NotRegistered:
                component = <RegisterUser />;
                break;
            case UserRegistrationStatus.Registered:
                large = true;
                component = <App />;
                break;
        }    
    }

    return (
        <Container maxWidth={large ? "lg" : "md"} className={containerClass}>
            {component}
        </Container>
    );
}