import { Dispatch } from "react";

import userMgmtService from "../../services/userMgmt/service";
import { MyProfile } from "../../domain/model/users";
import { HttpError } from "../../errors/httpError";
import { startSpinning, stopSpinning } from "../app/modalSpinner";

export const REGISTER_USER_REQUESTED = "REGISTER_USER_REQUESTED";
export const REGISTER_USER_SUCCEEDED = "REGISTER_USER_SUCCEEDED";
export const REGISTER_USER_FAILED_USER_EXISTS = "REGISTER_USER_FAILED_USER_EXISTS";
export const REGISTER_USER_FAILED_USERNAME_EXISTS = "REGISTER_USER_FAILED_USERNAME_EXISTS";
export const REGISTER_USER_FAILED = "REGISTER_USER_FAILED";
export const REGISTER_USER_LIMIT_REACHED = "REGISTER_USER_LIMIT_REACHED";

export default function(username: string) {
    return async (dispatch: Dispatch<any>) => {

        dispatch(startSpinning());

        const requestEvent: RegisterUserRequestedEvent = {
            type: REGISTER_USER_REQUESTED,
            payload: username
        };

        dispatch(requestEvent);

        const result = await userMgmtService.registerUser(username);

        let outcomeEvent;
        switch (result.kind) {
            case "success":
                outcomeEvent = {
                    type: REGISTER_USER_SUCCEEDED,
                    payload: result.myProfile
                } as  RegisterUserSucceededEvent;
                break;
            case "userExists":
                outcomeEvent = {
                    type: REGISTER_USER_FAILED_USER_EXISTS
                } as RegisterUserFailedUserExistsEvent;
                break;
            case "usernameTaken":
                outcomeEvent = {
                    type: REGISTER_USER_FAILED_USERNAME_EXISTS,
                    payload: username
                } as RegisterUserFailedUsernameExistsEvent;
                break;
            case "userLimitReached":
                outcomeEvent = {
                    type: REGISTER_USER_LIMIT_REACHED,
                    payload: result.userLimit
                } as RegisterUserLimitReachedEvent;
                break;
            case "httpError": 
                outcomeEvent = {
                    type: REGISTER_USER_FAILED,
                    httpError: result
                } as RegisterUserFailedEvent;
            break;
        }

        dispatch(outcomeEvent);

        dispatch(stopSpinning());

        return outcomeEvent;
    }
}

export type RegisterUserOutcomeEvent = RegisterUserSucceededEvent | RegisterUserFailedUserExistsEvent | RegisterUserFailedUsernameExistsEvent | RegisterUserFailedEvent | RegisterUserLimitReachedEvent;

export type RegisterUserRequestedEvent = {
    type: typeof REGISTER_USER_REQUESTED,
    payload: string
}

export type RegisterUserSucceededEvent = {
    type: typeof REGISTER_USER_SUCCEEDED,
    payload: MyProfile
}

export type RegisterUserFailedEvent = {
    type: typeof REGISTER_USER_FAILED,
    httpError?: HttpError
}

export type RegisterUserFailedUserExistsEvent = {
    type: typeof REGISTER_USER_FAILED_USER_EXISTS
}

export type RegisterUserFailedUsernameExistsEvent = {
    type: typeof REGISTER_USER_FAILED_USERNAME_EXISTS,
    payload: string
}

export type RegisterUserLimitReachedEvent = {
    type: typeof REGISTER_USER_LIMIT_REACHED,
    payload: bigint
}
