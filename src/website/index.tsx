import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { MuiThemeProvider } from "@material-ui/core";

import App from "./App";
import store from "./store";
import "./css/index.css";
import "./css/emoji-mart.css";
import { APP_TITLE } from "./constants";
import startup from "./startup"
import theme from "./theme";

document.title = APP_TITLE;

startup();

ReactDOM.render(
  <Provider store={store}>
    <MuiThemeProvider theme={theme}>
      <App />
    </MuiThemeProvider>
  </Provider>,
  document.getElementById("app")
);
