import { Dispatch } from "react";

import { MyProfile } from "../../domain/model/users";
import userMgmtService from "../../services/userMgmt/service";
import { HttpError } from "../../errors/httpError";

export const GET_CURRENT_USER_REQUESTED = "GET_CURRENT_USER_REQUESTED";
export const GET_CURRENT_USER_SUCCEEDED = "GET_CURRENT_USER_SUCCEEDED";
export const GET_CURRENT_USER_FAILED = "GET_CURRENT_USER_FAILED";

export default function() {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: GetCurrentUserRequestedEvent = {
            type: GET_CURRENT_USER_REQUESTED
        };

        dispatch(requestEvent);

        const result = await userMgmtService.getCurrentUser();

        let outcomeEvent;
        if (result.kind === "success") {
            outcomeEvent = {
                type: GET_CURRENT_USER_SUCCEEDED,
                payload: result.myProfile
            } as GetCurrentUserSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_CURRENT_USER_FAILED,
                httpError: result.kind === "httpError" ? result : undefined
            } as GetCurrentUserFailedEvent;
        }

        dispatch(outcomeEvent);
        return outcomeEvent;
    }
}

export type GetCurrentUserOutcome = GetCurrentUserSucceededEvent | GetCurrentUserFailedEvent;

export type GetCurrentUserRequestedEvent = {
    type: typeof GET_CURRENT_USER_REQUESTED
}

export type GetCurrentUserSucceededEvent = {
    type: typeof GET_CURRENT_USER_SUCCEEDED,
    payload: MyProfile
}

export type GetCurrentUserFailedEvent = {
    type: typeof GET_CURRENT_USER_FAILED,
    httpError?: HttpError
}
