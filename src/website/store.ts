import { createStore, applyMiddleware, compose } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";

import rootReducer from "./reducers";
import analyticsMiddleware from "./analytics/analyticsMiddleware";
import webRtcMiddleware from "./domain/webRtc/webRtcMiddleware";

const initialState = {};

const middleware = [thunk, webRtcMiddleware, analyticsMiddleware];

const store = createStore(
    rootReducer,
    initialState,
    compose(
        composeWithDevTools(applyMiddleware(...middleware))
    )
);

export default store;
