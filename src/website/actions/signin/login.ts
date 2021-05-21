import getAuthClient, { getTimeUntilSessionExpiryMs } from "../../utils/authClient";
import { IDP_URL } from "../../constants";
import { Dispatch } from "react";
import getCurrentUser from "../users/getCurrentUser";
import CanisterClientFactory from "../../services/CanisterClientFactory";
import SessionExpirationHandler from "../../domain/SessionExpirationHandler";

const SESSION_TIMEOUT_NANOS = BigInt(6 * 60 * 60 * 1000 * 1000 * 1000) // 6 hours

export default function login() {
    return async (dispatch: Dispatch<any>) => {
        let authClient = getAuthClient();
        await authClient.login({
            identityProvider: IDP_URL,
            maxTimeToLive: SESSION_TIMEOUT_NANOS,
            onSuccess: async () => {
                console.log(getTimeUntilSessionExpiryMs());
                const identity = authClient.getIdentity();
                await CanisterClientFactory.init(identity);
                dispatch(getCurrentUser());
                SessionExpirationHandler.startSession();
            }
        });
    }
}
