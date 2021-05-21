import { Middleware } from "redux";
import notifySessionExpired from "../actions/signin/notifySessionExpired";
import { RootState } from "../reducers";
import { getTimeUntilSessionExpiryMs } from "../utils/authClient";
import { HttpError } from "./httpError";

const errorHandlingMiddleware : Middleware<{}, RootState> = store => next => event => {
    if ("httpError" in event && event.httpError) {
        const httpError = event.httpError as HttpError;
        if (httpError.code === 401 
            || httpError.code === 403 
            || getTimeUntilSessionExpiryMs() <= 0) {
            return store.dispatch(notifySessionExpired() as any);
        }
    }
    
    return next(event);
}

export default errorHandlingMiddleware;
