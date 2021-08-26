import getAuthClient, { getTimeUntilSessionExpiryMs } from "../../utils/authClient";
import { Dispatch } from "react";
import getCurrentUser from "../users/getCurrentUser";
import CanisterClientFactory from "../../services/CanisterClientFactory";
import SessionExpirationHandler from "../../domain/SessionExpirationHandler";

const SESSION_TIMEOUT_NANOS = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000) // 30 days

export default function login() {
    return async (dispatch: Dispatch<any>) => {
        let authClient = getAuthClient();
        await authClient.login({
            identityProvider: process.env.IDP_URL,
            maxTimeToLive: SESSION_TIMEOUT_NANOS,
            onSuccess: async () => {
                const identity = authClient.getIdentity();
                await CanisterClientFactory.init(identity);
                dispatch(getCurrentUser());
                SessionExpirationHandler.startSession();
            }
        });
    }
}
