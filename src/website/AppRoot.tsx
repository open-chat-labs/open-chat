import React from "react";
import { Provider } from "react-redux";
import { MuiThemeProvider, StyledEngineProvider } from "@material-ui/core";

import App from "./components/App";
import store from "./store";
import { lightTheme, darkTheme } from "./theme";

export default AppRoot;

function AppRoot() {
    const theme = lightTheme;

    return (
        <Provider store={store}>
            <StyledEngineProvider injectFirst>
                <MuiThemeProvider theme={theme}>
                    <App />
                </MuiThemeProvider>
            </StyledEngineProvider>
        </Provider>
    );
}
