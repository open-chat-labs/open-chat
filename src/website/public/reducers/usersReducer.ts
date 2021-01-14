import produce from "immer";

import { DirectChat, GroupChat } from "../model/chats";
import { Option } from "../model/common";
import { UserId, UserSummary } from "../model/users";
import * as setFunctions from "../utils/setFunctions";

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

export type UsersState = {
    mustRegisterAsNewUser: boolean,
    me: Option<UserSummary>,
    unknownUserIds: UserId[],
    userDictionary: {}
}

const initialState: UsersState = {
    mustRegisterAsNewUser: false,
    me: null,
    unknownUserIds: [],
    userDictionary: {}
};

export default produce((state: UsersState, event: Event) => {
    switch (event.type) {
        case GET_ALL_CHATS_SUCCEEDED: {
            const { chats } = event.payload;
            const unknownUserIds = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;

            for (const chat of chats) {
                if (chat.kind === "direct") {
                    if (!userDictionary.hasOwnProperty(chat.them)) {
                        setFunctions.add(unknownUserIds, chat.them);
                    }
                } else if (chat.kind === "group") {
                    chat.participants.forEach((p: UserId) => {
                        if (!userDictionary.hasOwnProperty(p)) {
                            setFunctions.add(unknownUserIds, p);
                        }
                    })
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
            const users = event.payload;
            const unknownUserIds: UserId[] = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;

            for (const user of users) {
                setFunctions.remove(unknownUserIds, user.userId);
                userDictionary[user.userId] = user;
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
    }
}, initialState);
