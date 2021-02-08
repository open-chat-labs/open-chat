import { createStore, applyMiddleware, compose } from "redux";
import { composeWithDevTools } from "redux-devtools-extension/developmentOnly";
import thunk from "redux-thunk";

import rootReducer from "./reducers";
import webRtcMiddleware from "./webRtc/webRtcMiddleware";

const initialState = {};

const middleware = [webRtcMiddleware, thunk];

const store = createStore(
    rootReducer,
    initialState,
    compose(
        composeWithDevTools(applyMiddleware(...middleware))
    )
);

export default store;
