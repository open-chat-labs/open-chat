import React, { useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import useTheme from "@material-ui/core/styles/useTheme";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import StyledEngineProvider from "@material-ui/styled-engine/StyledEngineProvider";
import Container from "@material-ui/core/Container";
import App from "./App";
import store from "../store";
import CanisterClientFactory from "../services/CanisterClientFactory";
import Login from "./Login";
import ThemeProvider from "./ThemeProvider";
import { UserRegistrationStatus } from "../reducers/usersReducer";
import RegisterUser from "./RegisterUser";
import getCurrentUser from "../actions/users/getCurrentUser";
import getAuthClient from "../utils/authClient";
import AlertDialog, {AlertContent} from "./AlertDialog";
import { Option } from "../domain/model/common";
import { sessionExpiryAcknowledged } from "../actions/signin/notifySessionExpired";

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
        input: {
            backgroundColor: "transparent"
        },
        a: {
            color: theme.colors.linkColor
        },
        "body, input": {
            color: theme.colors.textColor
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
                <ThemeProvider>
                    <AppContainer />
                </ThemeProvider>
            </StyledEngineProvider>
        </Provider>
    );
}

function AppContainer() {
    const identity = getAuthClient().getIdentity();
    const isAnonymous = identity.getPrincipal().isAnonymous();

    const [canisterClientFactory, setCanisterClientFactory] = useState<CanisterClientFactory>();

    CanisterClientFactory.current = canisterClientFactory ?? null;
    if (!CanisterClientFactory.current) {
        CanisterClientFactory.create(identity).then(setCanisterClientFactory);
    }

    const dispatch = useDispatch();
    const sessionExpired = useSelector((state: RootState) => state.appState.sessionExpired);
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

    if (!CanisterClientFactory.current) {
        component = <div />;
    } else if (isAnonymous || (sessionExpired && userRegistrationStatus !== UserRegistrationStatus.Registered)) {
        component = <Login />;
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

    const sessionExpiredAlert: Option<AlertContent> = sessionExpired
        ? {
            title: "Session Expired",
            message: "Your session has expired - please login again"
        }
        : null;

    return (
        <Container maxWidth={large ? "lg" : "md"} className={containerClass}>
            {component}
            {sessionExpiredAlert ?
                <AlertDialog
                    content={sessionExpiredAlert}
                    onClose={() => dispatch(sessionExpiryAcknowledged())}
                /> : null}
        </Container>
    );
}
