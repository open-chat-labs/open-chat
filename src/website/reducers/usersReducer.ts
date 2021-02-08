import produce from "immer";

import { Option, Timestamp } from "../model/common";
import { UserId, UserSummary, MyProfile } from "../model/users";
import * as dateFunctions from "../utils/dateFunctions";
import * as setFunctions from "../utils/setFunctions";

import { GET_ALL_CHATS_SUCCEEDED, GetAllChatsSucceededEvent } from "../actions/chats/getAllChats";
import { GET_UPDATED_CHATS_SUCCEEDED, GetUpdatedChatsSucceededEvent } from "../actions/chats/getUpdatedChats";
import { SETUP_NEW_DIRECT_CHAT_SUCCEEDED, SetupNewDirectChatSucceededEvent } from "../actions/chats/setupNewDirectChat";
import { CONFIRMED_DIRECT_CHAT, CONFIRMED_GROUP_CHAT } from "../constants";

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

import {
    UPDATE_MINUTES_SINCE_LAST_ONLINE,
    UpdateMinutesSinceLastOnline
} from "../actions/users/updateMinutesSinceLastOnline";

export type Event =
    GetAllChatsSucceededEvent |
    GetCurrentUserRequestedEvent |
    GetCurrentUserSucceededEvent |
    GetCurrentUserFailedEvent |
    GetUpdatedChatsSucceededEvent |
    GetUsersRequestedEvent |
    GetUsersSucceededEvent |
    GetUsersFailedEvent |
    RegisterUserRequestedEvent |
    RegisterUserSucceededEvent |
    RegisterUserFailedUserExistsEvent |
    RegisterUserFailedUsernameExistsEvent |
    SetupNewDirectChatSucceededEvent |
    UpdateMinutesSinceLastOnline;

export type UsersState = {
    mustRegisterAsNewUser: boolean,
    me: Option<MyProfile>,
    unknownUserIds: UserId[],
    userDictionary: any,
    usersSyncedUpTo: Option<Timestamp>
}

const initialState: UsersState = {
    mustRegisterAsNewUser: false,
    me: null,
    unknownUserIds: [],
    userDictionary: {},
    usersSyncedUpTo: null
};

export default produce((state: UsersState, event: Event) => {
    switch (event.type) {
        case GET_ALL_CHATS_SUCCEEDED:
        case GET_UPDATED_CHATS_SUCCEEDED: {
            const { chats } = event.payload;
            const unknownUserIds = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;
            const myUserId = state.me!.userId;

            for (const chat of chats) {
                if (chat.kind === CONFIRMED_DIRECT_CHAT) {
                    if (!userDictionary.hasOwnProperty(chat.them)) {
                        setFunctions.add(unknownUserIds, chat.them);
                    }
                } else if (chat.kind === CONFIRMED_GROUP_CHAT) {
                    chat.participants.forEach((p: UserId) => {
                        if (p !== myUserId && !userDictionary.hasOwnProperty(p)) {
                            setFunctions.add(unknownUserIds, p);
                        }
                    });
                }
            }
            break;
        }

        case GET_CURRENT_USER_SUCCEEDED: {
            state.mustRegisterAsNewUser = false;
            state.me = event.payload;
            break;
        }

        case GET_CURRENT_USER_FAILED: {
            state.mustRegisterAsNewUser = true;
            state.me = null;
            break;
        }

        case GET_USERS_SUCCEEDED: {
            const { request, result } = event.payload;
            const unknownUserIds: UserId[] = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;

            for (const user of result.users) {
                setFunctions.remove(unknownUserIds, user.userId);
                userDictionary[user.userId] = user;
            }

            // Only bump the usersSyncedUpTo value if all users were requested
            if (request.users.length === Object.keys(userDictionary).length) {
                state.usersSyncedUpTo = result.timestamp;
            }
            break;
        }

        case REGISTER_USER_SUCCEEDED: {
            alert("Hi " + event.payload.username + "!");
            state.mustRegisterAsNewUser = false;
            state.me = event.payload;
            break;
        }

        case REGISTER_USER_FAILED_USER_EXISTS: {
            alert("You already have a user account");
            state.mustRegisterAsNewUser = false;
            break;
        }

        case REGISTER_USER_FAILED_USERNAME_EXISTS: {
            alert("Username taken");
            state.mustRegisterAsNewUser = true;
            break;
        }

        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            const user = event.payload;
            const unknownUserIds = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;

            setFunctions.remove(unknownUserIds, user.userId);
            userDictionary[user.userId] = user;
            break;
        }

        case UPDATE_MINUTES_SINCE_LAST_ONLINE: {
            for (const value of Object.values(state.userDictionary)) {
                const user = value as UserSummary;
                user.minutesSinceLastOnline = Math.floor(dateFunctions.getMinutesSince(user.lastOnline));
            }
            break;
        }
    }
}, initialState);
