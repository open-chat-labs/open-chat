import { Middleware } from "redux";
import { RootState } from "../reducers";
import trackEvent from "./eventTracker";
const analyticsMiddleware : Middleware<{}, RootState> = store => next => event => {
    trackEvent(event.type, event.payload);
    return next(event);
}

export default analyticsMiddleware;
