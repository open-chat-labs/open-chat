import { Dispatch } from "react";

import { Option, Timestamp } from "../../domain/model/common";
import { UserId, UserSummary } from "../../domain/model/users";
import { GetUsersRequest } from "../../services/userMgmt/getUsers";
import userMgmtService from "../../services/userMgmt/service";
import { HttpError } from "../../errors/httpError";

export const GET_USERS_REQUESTED = "GET_USERS_REQUESTED";
export const GET_USERS_SUCCEEDED = "GET_USERS_SUCCEEDED";
export const GET_USERS_FAILED = "GET_USERS_FAILED";

export default function(users: UserId[], updatedSince: Option<Timestamp> = null) {
    return async (dispatch: Dispatch<any>) => {
        const request: GetUsersRequest = {
            users,
            updatedSince
        };

        const requestAction: GetUsersRequestedEvent = {
            type: GET_USERS_REQUESTED,
            payload: request
        };

        dispatch(requestAction);

        const result = await userMgmtService.getUsers(request);

        let outcomeEvent;
        if (result.kind === "success") {
            outcomeEvent = {
                type: GET_USERS_SUCCEEDED,
                payload: {
                    request,
                    result: {
                        users: result.users,
                        timestamp: result.timestamp
                    }
                }
            } as GetUsersSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_USERS_FAILED,
                payload: request,
                httpError: result.kind === "httpError" ? result : undefined
            } as GetUsersFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetUsersRequestedEvent = {
    type: typeof GET_USERS_REQUESTED,
    payload: GetUsersRequest
}

export type GetUsersSucceededEvent = {
    type: typeof GET_USERS_SUCCEEDED,
    payload: {
        request: GetUsersRequest,
        result: {
            users: UserSummary[],
            timestamp: Timestamp
        }
    }
}

export type GetUsersFailedEvent = {
    type: typeof GET_USERS_FAILED,
    payload: GetUsersRequest,
    httpError?: HttpError
}
