import React from "react";
import ReactDOM from "react-dom";
import AppRoot from "./components/AppRoot";
import "./css/index.css";
import "./css/emoji-mart.css";
import { APP_TITLE } from "./constants";
import startup from "./startup"

document.title = APP_TITLE;

startup().then(() => ReactDOM.render(<AppRoot />, document.getElementById("app")));
