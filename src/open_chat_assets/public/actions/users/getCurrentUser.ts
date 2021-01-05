import { UserSummary } from "../../model/users";
import userMgmtService from "../../services/userMgmt/service";

export const GET_CURRENT_USER_REQUESTED = "GET_CURRENT_USER_REQUESTED";
export const GET_CURRENT_USER_SUCCEEDED = "GET_CURRENT_USER_SUCCEEDED";
export const GET_CURRENT_USER_FAILED = "GET_CURRENT_USER_FAILED";

export default function() {
    return async (dispatch: any) => {
        const requestEvent: GetCurrentUserRequestedEvent = {
            type: GET_CURRENT_USER_REQUESTED
        };

        dispatch(requestEvent);

        const result = await userMgmtService.getCurrentUser();

        let outcomeEvent;
        if (result.kind === "success") {
            outcomeEvent = {
                type: GET_CURRENT_USER_SUCCEEDED,
                payload: result.userSummary
            } as GetCurrentUserSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_CURRENT_USER_FAILED
            } as GetCurrentUserFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetCurrentUserRequestedEvent = {
    type: typeof GET_CURRENT_USER_REQUESTED
}

export type GetCurrentUserSucceededEvent = {
    type: typeof GET_CURRENT_USER_SUCCEEDED,
    payload: UserSummary
}

export type GetCurrentUserFailedEvent = {
    type: typeof GET_CURRENT_USER_FAILED
}
