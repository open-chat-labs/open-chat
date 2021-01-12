import { Option } from "../model/common";
import { UserId, UserSummary } from "../model/users";

import { GET_ALL_CHATS_SUCCEEDED, GetAllChatsSucceededEvent } from "../actions/chats/getAllChats";
import { SETUP_NEW_DIRECT_CHAT_SUCCEEDED, SetupNewDirectChatSucceededEvent } from "../actions/chats/setupNewDirectChat";

import {
    GET_CURRENT_USER_FAILED,
    GET_CURRENT_USER_SUCCEEDED,
    GetCurrentUserFailedEvent,
    GetCurrentUserRequestedEvent,
    GetCurrentUserSucceededEvent
} from "../actions/users/getCurrentUser";

import {
    GET_USERS_SUCCEEDED,
    GetUsersFailedEvent,
    GetUsersRequestedEvent,
    GetUsersSucceededEvent
} from "../actions/users/getUsers";

import {
    REGISTER_USER_FAILED_USER_EXISTS,
    REGISTER_USER_FAILED_USERNAME_EXISTS,
    REGISTER_USER_SUCCEEDED,
    RegisterUserFailedUserExistsEvent,
    RegisterUserFailedUsernameExistsEvent,
    RegisterUserRequestedEvent,
    RegisterUserSucceededEvent
} from "../actions/users/registerUser";

export type Event =
    GetAllChatsSucceededEvent |
    GetCurrentUserRequestedEvent |
    GetCurrentUserSucceededEvent |
    GetCurrentUserFailedEvent |
    GetUsersRequestedEvent |
    GetUsersSucceededEvent |
    GetUsersFailedEvent |
    RegisterUserRequestedEvent |
    RegisterUserSucceededEvent |
    RegisterUserFailedUserExistsEvent |
    RegisterUserFailedUsernameExistsEvent |
    SetupNewDirectChatSucceededEvent;

type State = {
    mustRegisterAsNewUser: boolean,
    me: Option<UserSummary>,
    unknownUserIds: UserId[],
    userDictionary: {}
}

const initialState: State = {
    mustRegisterAsNewUser: false,
    me: null,
    unknownUserIds: [],
    userDictionary: {}
};

export default function(state: State = initialState, event: Event) : State {
    switch (event.type) {
        case GET_ALL_CHATS_SUCCEEDED: {
            const chats = event.payload;
            const unknownUserIds = [...state.unknownUserIds];
            const userDictionary: any = state.userDictionary;

            chats.forEach((c => {
                if (c.kind === "direct") {
                    if (!userDictionary.hasOwnProperty(c.them.toString()) &&
                        !unknownUserIds.find(u => u === c.them)) {
                        unknownUserIds.push(c.them);
                    }
                } else {
                    c.participants.forEach((p: UserId) => {
                        if (!userDictionary.hasOwnProperty(p.toString()) &&
                            !unknownUserIds.find(u => u === p)) {
                            unknownUserIds.push(p);
                        }
                    })
                }
            }));

            return {
                ...state,
                unknownUserIds
            };
        }

        case GET_CURRENT_USER_SUCCEEDED: {
            return {
                ...state,
                mustRegisterAsNewUser: false,
                me: event.payload
            };
        }

        case GET_CURRENT_USER_FAILED: {
            return {
                ...state,
                mustRegisterAsNewUser: true,
                me: null
            };
        }

        case GET_USERS_SUCCEEDED: {
            const users = event.payload;
            const unknownUserIds: UserId[] = state.unknownUserIds.slice();
            const userDictionary: any = { ...state.userDictionary };

            users.forEach(user => {
                const index = state.unknownUserIds.findIndex(u => u === user.userId);
                if (index >= 0) {
                    unknownUserIds.splice(index, 1);
                }
                userDictionary[user.userId.toString()] = user;
            });

            return {
                ...state,
                unknownUserIds,
                userDictionary
            }
        }

        case REGISTER_USER_SUCCEEDED: {
            alert("Hi " + event.payload.username + "!");

            return {
                ...state,
                mustRegisterAsNewUser: false,
                me: event.payload
            };
        }

        case REGISTER_USER_FAILED_USER_EXISTS: {
            alert("You already have a user account");

            return {
                ...state,
                mustRegisterAsNewUser: false
            };
        }

        case REGISTER_USER_FAILED_USERNAME_EXISTS: {
            alert("Username taken");

            return {
                ...state,
                mustRegisterAsNewUser: true
            };
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const user = event.payload;
            const unknownUserIds = [...state.unknownUserIds];
            const userDictionary: any = { ...state.userDictionary };

            const index = unknownUserIds.findIndex(u => u === user.userId);

            if (index >= 0) {
                unknownUserIds.splice(index, 1);
            }

            userDictionary[user.userId.toString()] = user;

            return {
                ...state,
                unknownUserIds,
                userDictionary
            };
        }

        default:
            return state;
    }
}
