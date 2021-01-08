import { Dispatch } from "react";

import userMgmtService from "../../services/userMgmt/service";
import { RootState } from "../../reducers";
import { Chat } from "../../model/chats";
import { Option } from "../../model/common";
import { UserId, UserSummary } from "../../model/users";

export const SETUP_NEW_DIRECT_CHAT_REQUESTED = "SETUP_NEW_DIRECT_CHAT_REQUESTED";
export const SETUP_NEW_DIRECT_CHAT_SUCCEEDED = "SETUP_NEW_DIRECT_CHAT_SUCCEEDED";
export const SETUP_NEW_DIRECT_CHAT_FAILED_USER_NOT_FOUND = "SETUP_NEW_DIRECT_CHAT_FAILED_USER_NOT_FOUND";
export const SETUP_NEW_DIRECT_CHAT_FAILED_CHAT_ALREADY_EXISTS = "SETUP_NEW_DIRECT_CHAT_FAILED_CHAT_ALREADY_EXISTS";
export const SETUP_NEW_DIRECT_CHAT_FAILED_CANT_CREATE_CHAT_WITH_SELF = "SETUP_NEW_DIRECT_CHAT_FAILED_CANT_CREATE_CHAT_WITH_SELF";

export default function(username: string) {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        const requestEvent: SetupNewDirectChatRequestedEvent = {
            type: SETUP_NEW_DIRECT_CHAT_REQUESTED,
            payload: username
        };

        dispatch(requestEvent);

        const outcomeEvent = await getOutcomeEvent();

        dispatch(outcomeEvent);

        async function getOutcomeEvent() {
            const state = getState();

            if (state.usersState.me!.username === username) {
                return  {
                    type: SETUP_NEW_DIRECT_CHAT_FAILED_CANT_CREATE_CHAT_WITH_SELF
                } as SetupNewDirectChatFailedCantCreateChatWithSelfEvent;
            }

            let userId = findUserId(state.usersState.userDictionary, username);
            if (!userId) {
                const getUserResponse = await userMgmtService.getUserId(username);

                if (getUserResponse.kind === "success") {
                    userId = getUserResponse.userId;
                } else {
                    return {
                        type: SETUP_NEW_DIRECT_CHAT_FAILED_USER_NOT_FOUND,
                        payload: username
                    } as SetupNewDirectChatFailedUserNotFoundEvent;
                }
            }

            if (!chatAlreadyExists(state.chatsState.chats, userId)) {
                return {
                    type: SETUP_NEW_DIRECT_CHAT_SUCCEEDED,
                    payload: {
                        userId,
                        username,
                        version: 0
                    }
                } as SetupNewDirectChatSucceededEvent;
            } else {
                return {
                    type: SETUP_NEW_DIRECT_CHAT_FAILED_CHAT_ALREADY_EXISTS,
                    payload: username
                } as SetupNewDirectChatFailedChatAlreadyExistsEvent;
            }
        }
    }
}

function chatAlreadyExists(chats: Chat[], userId: UserId) : boolean {
    const chat = chats.find(c => c.kind === "direct" && c.them === userId);

    return Boolean(chat);
}

function findUserId(userDictionary: any, username: string) : Option<UserId> {
    const key = Object.keys(userDictionary).find(k => userDictionary[k].username === username);

    return key ? userDictionary[key].userId : null;
}

export type SetupNewDirectChatRequestedEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_REQUESTED,
    payload: string
}

export type SetupNewDirectChatSucceededEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_SUCCEEDED,
    payload: UserSummary
}

export type SetupNewDirectChatFailedUserNotFoundEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_FAILED_USER_NOT_FOUND,
    payload: string
}

export type SetupNewDirectChatFailedChatAlreadyExistsEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_FAILED_CHAT_ALREADY_EXISTS,
    payload: string
}

export type SetupNewDirectChatFailedCantCreateChatWithSelfEvent = {
    type: typeof SETUP_NEW_DIRECT_CHAT_FAILED_CANT_CREATE_CHAT_WITH_SELF
}
