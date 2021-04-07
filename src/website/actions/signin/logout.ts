import authClient from "../../utils/authClient";

export const USER_LOGGED_OUT = "USER_LOGGED_OUT";

export default function logout() : UserLoggedOutEvent {
    authClient.logout();

    return {
        type: USER_LOGGED_OUT
    };
}

export type UserLoggedOutEvent = {
    type: typeof USER_LOGGED_OUT
}
