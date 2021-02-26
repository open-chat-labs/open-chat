import React from "react";
import { Provider } from "react-redux";
import { MuiThemeProvider } from "@material-ui/core";

import App from "./components/App";
import store from "./store";
import { lightTheme, darkTheme } from "./theme";

export default AppRoot;

function AppRoot() {
    const theme = lightTheme;

    return (
        <Provider store={store}>
            <MuiThemeProvider theme={theme}>
                <App />
            </MuiThemeProvider>
        </Provider>
    );
}
