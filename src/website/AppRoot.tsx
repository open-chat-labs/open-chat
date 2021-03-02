import React from "react";
import { Provider } from "react-redux";
import MuiThemeProvider from "@material-ui/core/styles/ThemeProvider";
import StyledEngineProvider from "@material-ui/styled-engine/StyledEngineProvider";

import App from "./components/App";
import store from "./store";
import { lightTheme, darkTheme } from "./theme";
import CanisterClientFactory from "./services/CanisterClientFactory";
import { Principal } from "@dfinity/agent";
import authClient from "./utils/authClient";
import Login from "./components/Login";

export default AppRoot;

export function handleAuthRedirect() {
    // Check if we need to parse the authentication.
    if (authClient.shouldParseResult(location)) {
        authClient.handleRedirectCallback(location);
    }
}

const canisterIds = {
    chats: Principal.fromText("sadjp-vqaaa-aaaab-qaipa-cai"),
    p2p: Principal.fromText("shcp3-yiaaa-aaaab-qaipq-cai"),
    userMgmt: Principal.fromText("x3zv6-taaaa-aaaab-qaiqa-cai")
};

function AppRoot() {
    const theme = lightTheme;

    handleAuthRedirect();

    const identity = authClient.getIdentity();
    const isAnonymous = identity.getPrincipal().isAnonymous();
    CanisterClientFactory.current = new CanisterClientFactory(identity, canisterIds);

    return (
        <Provider store={store}>
            <StyledEngineProvider injectFirst>
                <MuiThemeProvider theme={theme}>
                    {isAnonymous ? <Login canisterIds={canisterIds} /> : <App />}
                </MuiThemeProvider>
            </StyledEngineProvider>
        </Provider>
    );
}
