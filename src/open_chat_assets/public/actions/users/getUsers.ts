import { UserSummary } from "../../model/users";
import { GetUserRequest } from "../../services/userMgmt/getUsers";
import userMgmtService from "../../services/userMgmt/service";

export const GET_USERS_REQUESTED = "GET_USERS_REQUESTED";
export const GET_USERS_SUCCEEDED = "GET_USERS_SUCCEEDED";
export const GET_USERS_FAILED = "GET_USERS_FAILED";

export default function(users: GetUserRequest[]) {
    return async (dispatch: any) => {
        const requestAction: GetUsersRequestedEvent = {
            type: GET_USERS_REQUESTED
        };

        dispatch(requestAction);

        const result = await userMgmtService.getUsers(users);

        let outcomeEvent;
        if (result.kind === "success") {
            outcomeEvent = {
                type: GET_USERS_SUCCEEDED,
                payload: result.users
            } as GetUsersSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_USERS_FAILED,
            } as GetUsersFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetUsersRequestedEvent = {
    type: typeof GET_USERS_REQUESTED
}

export type GetUsersSucceededEvent = {
    type: typeof GET_USERS_SUCCEEDED,
    payload: UserSummary[]
}

export type GetUsersFailedEvent = {
    type: typeof GET_USERS_FAILED
}
