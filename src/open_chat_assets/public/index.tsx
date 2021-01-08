import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";

import App from "./App";
import store from "./store";
import "./index.css";

// Needed for serializing ChatId values
(BigInt.prototype as any).toJSON = function() { return this.toString(); };

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("app")
);
