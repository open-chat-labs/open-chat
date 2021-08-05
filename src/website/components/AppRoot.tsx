import React, { useEffect, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import useTheme from "@material-ui/core/styles/useTheme";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import StyledEngineProvider from "@material-ui/styled-engine/StyledEngineProvider";
import Container from "@material-ui/core/Container";
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import ModalContainer from "react-modal-promise";
import { DelegationIdentity } from "@dfinity/identity";
import { RootState } from "../reducers";
import App from "./App";
import store from "../store";
import CanisterClientFactory from "../services/CanisterClientFactory";
import Login from "./Login";
import ThemeProvider from "./ThemeProvider";
import { UserRegistrationStatus } from "../reducers/usersReducer";
import RegisterUser from "./RegisterUser";
import getCurrentUser from "../actions/users/getCurrentUser";
import getAuthClient from "../utils/authClient";
import { sessionExpiryAcknowledged } from "../actions/signin/notifySessionExpired";
import SessionExpirationHandler from "../domain/SessionExpirationHandler";
import switchViewMode from "../actions/app/switchViewMode";
import { ViewMode } from "../domain/model/viewMode";
import { gotoChatById } from "../actions/chats/gotoChat";
import gotoHome from "../actions/app/gotoHome";
import { alertDialog } from "./modals/Alert";

export default AppRoot;

const useStyles = makeStyles((theme: Theme) => ({
    "@global": {
        body: {
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
        },
        "h1": {
            fontSize: "6rem",
            fontWeight: 300,
            margin: 0,
            [theme.breakpoints.down('sm')]: {
                fontSize: "3rem"
            }    
        }
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    container: {
        padding: 24,
        height: "100%",
        "&.no-padding": {
            padding: 0
        },
        [theme.breakpoints.down('sm')]: {
            position: "fixed",
            top: 0
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
    const dispatch = useDispatch();
    const identity = getAuthClient().getIdentity();
    const isAnonymous = identity.getPrincipal().isAnonymous();
    const [canisterClientFactoryRequiresInit, setCanisterClientFactoryRequiresInit] = useState(!isAnonymous && CanisterClientFactory.current == null);
    const sessionExpired = useSelector((state: RootState) => state.appState.sessionExpired);
    const currentUser = useSelector((state: RootState) => state.usersState.me);
    const userRegistrationStatus = useSelector((state: RootState) => state.usersState.userRegistrationStatus);
    const currentViewMode = useSelector((state: RootState) => state.appState.viewMode);
    const modalSpinner = useSelector((state: RootState) => state.appState.modalSpinner);
    const classes = useStyles();
    const theme = useTheme();
    const targetViewMode = useMediaQuery(theme.breakpoints.down("sm")) ? ViewMode.Mobile : ViewMode.Desktop;
    const removePadding = useMediaQuery(theme.breakpoints.down("lg"));

    let containerClass = classes.container;

    let component;
    let large = false;

    if (canisterClientFactoryRequiresInit) {
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

    if (removePadding && large) {
        containerClass += " no-padding";
    }

    useEffect(() => {
        if (sessionExpired) {
            (async () => {
                await alertDialog({
                    title: "Session Expired",
                    text: "Your session has expired - please login again",
                });
    
                dispatch(sessionExpiryAcknowledged());
            })()            
        }
    }, [sessionExpired]);

    useEffect(() => {
        if (currentViewMode !== targetViewMode) {
            dispatch(switchViewMode(targetViewMode));
        }            
    }, [targetViewMode, currentViewMode]);

    useEffect(() => {
        if (canisterClientFactoryRequiresInit) {
            CanisterClientFactory.init(identity).then(_ => setCanisterClientFactoryRequiresInit(false));
        }
    }, []);

    useEffect(() => {
        window.onpopstate = function(event: PopStateEvent) {
            if (event.state?.chatId) {
                dispatch(gotoChatById(event.state.chatId, undefined, true));
            } else {
                dispatch(gotoHome());
            }
        };        
        return () => {
            window.onpopstate = () => null;
        }
    }, []);

    useEffect(() => {
        // https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
        function setDocVh() {
            // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
            let vh = window.innerHeight * 0.01;
            // Then we set the value in the --vh custom property to the root of the document
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }

        window.onresize = () => setDocVh()

        setDocVh();
    }, []);

    useEffect(() => {
        if (currentUser && !isAnonymous && identity instanceof DelegationIdentity) {
            SessionExpirationHandler.startSession();
        }
    }, [currentUser?.userId]);

    return (
        <>
            <Container maxWidth={large ? "lg" : "md"} className={containerClass}>
                {component}
                <ModalContainer />
            </Container>
            <Backdrop className={classes.backdrop} open={modalSpinner}>
                <CircularProgress color="inherit" />
            </Backdrop>        
        </>
    );
}
