import getAuthClient from "../../utils/authClient";
import { IDP_URL } from "../../constants";
import { Dispatch } from "react";
import getCurrentUser from "../users/getCurrentUser";
import CanisterClientFactory from "../../services/CanisterClientFactory";

export default function login() {
    return async (dispatch: Dispatch<any>) => {
        let authClient = getAuthClient();
        await authClient.login({
            identityProvider: IDP_URL,
            onSuccess: () => {
                CanisterClientFactory.current = new CanisterClientFactory(authClient.getIdentity());
                dispatch(getCurrentUser())
            }
        });
    }
}
