import getAuthClient from "../../utils/authClient";
import { Dispatch } from "react";

export const USER_LOGGED_OUT = "USER_LOGGED_OUT";

export default function logout() {
    return async (dispatch: Dispatch<any>) => {
        await getAuthClient().logout();

        const userLoggedOutEvent: UserLoggedOutEvent = {
            type: USER_LOGGED_OUT
        };

        dispatch(userLoggedOutEvent);
    };
}

export type UserLoggedOutEvent = {
    type: typeof USER_LOGGED_OUT
}
