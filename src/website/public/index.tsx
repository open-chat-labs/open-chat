import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";

import App from "./App";
import store from "./store";
import "./css/index.css";
import "./css/emoji-mart.css";
import { APP_TITLE } from "./constants";
import startup from "./startup"

document.title = APP_TITLE;

startup();

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("app")
);
