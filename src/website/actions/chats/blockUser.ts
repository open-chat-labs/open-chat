import { Dispatch } from "react";
import { UserId } from "../../domain/model/users";
import chatsService from "../../services/chats/service";
import { startSpinning, stopSpinning } from "../app/modalSpinner";

export const USER_BLOCKED = "USER_BLOCKED";
export const USER_UNBLOCKED = "USER_UNBLOCKED";

export function blockUser(userId: UserId, unblock: boolean) {
    return async (dispatch: Dispatch<any>) : Promise<void> => {
        dispatch(startSpinning());
        await chatsService.blockUser(userId, unblock);
        let event: UserBlockedEvent | UserUnblockedEvent = {
            type: unblock ? USER_UNBLOCKED : USER_BLOCKED,
            payload: {
                userId
            }
        };
        dispatch(event);
        dispatch(stopSpinning());
    }
}

export type UserBlockedEvent = {
    type: typeof USER_BLOCKED,
    payload: {
        userId: UserId
    }
}

export type UserUnblockedEvent = {
    type: typeof USER_UNBLOCKED,
    payload: {
        userId: UserId
    }
}