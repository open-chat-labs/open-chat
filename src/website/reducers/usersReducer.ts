import produce from "immer";

import { Option, Timestamp } from "../domain/model/common";
import { UserId, UserSummary, MyProfile } from "../domain/model/users";
import * as dateFunctions from "../utils/dateFunctions";
import * as setFunctions from "../utils/setFunctions";

import { CONFIRMED_DIRECT_CHAT, CONFIRMED_GROUP_CHAT } from "../constants";
import { DIRECT_CHAT_CREATED, DirectChatCreatedEvent } from "../actions/chats/gotoUser";
import { GET_ALL_CHATS_SUCCEEDED, GetAllChatsSucceededEvent } from "../actions/chats/getAllChats";
import { GET_UPDATED_CHATS_SUCCEEDED, GetUpdatedChatsSucceededEvent } from "../actions/chats/getUpdatedChats";
import { MARK_REMOTE_USER_ONLINE, MarkRemoteUserOnlineEvent } from "../actions/users/markRemoteUserOnline";
import { USER_LOGGED_OUT, UserLoggedOutEvent } from "../actions/signin/logout";
import { SESSION_EXPIRED, SessionExpiredEvent } from "../actions/signin/notifySessionExpired";

import {
    GET_CURRENT_USER_FAILED,
    GET_CURRENT_USER_SUCCEEDED,
    GetCurrentUserFailedEvent,
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

import { 
    SET_PROFILE_IMAGE_REQUESTED,
    SET_PROFILE_IMAGE_FAILED,
    SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED,
    SetProfileImageRequestedEvent, 
    SetProfileImageFailedEvent,
    SetProfileImageDataUploadFailedEvent
} from "../actions/users/setProfileImage";

export type Event =
    DirectChatCreatedEvent |
    GetAllChatsSucceededEvent |
    GetCurrentUserSucceededEvent |
    GetCurrentUserFailedEvent |
    GetUpdatedChatsSucceededEvent |
    GetUsersRequestedEvent |
    GetUsersSucceededEvent |
    GetUsersFailedEvent |
    MarkRemoteUserOnlineEvent |
    RegisterUserRequestedEvent |
    RegisterUserSucceededEvent |
    RegisterUserFailedUserExistsEvent |
    RegisterUserFailedUsernameExistsEvent |
    SessionExpiredEvent |
    SetProfileImageRequestedEvent |
    SetProfileImageFailedEvent |
    SetProfileImageDataUploadFailedEvent |
    UpdateMinutesSinceLastOnline |
    UserLoggedOutEvent;

export type UsersState = {
    userRegistrationStatus: UserRegistrationStatus,
    me: Option<MyProfile>,
    unknownUserIds: UserId[],
    userDictionary: any,
    usersSyncedUpTo: Option<Timestamp>
}

export enum UserRegistrationStatus {
    Unknown,
    NotRegistered,
    Registered
}

const initialState: UsersState = {
    userRegistrationStatus: UserRegistrationStatus.Unknown,
    me: null,
    unknownUserIds: [],
    userDictionary: {},
    usersSyncedUpTo: null
};

export default produce((state: UsersState, event: Event) => {
    switch (event.type) {
        case DIRECT_CHAT_CREATED: {
            const { user } = event.payload;
            const unknownUserIds = state.unknownUserIds;
            const userDictionary: any = state.userDictionary;
            setFunctions.remove(unknownUserIds, user.userId);
            if (!userDictionary.hasOwnProperty(user.userId)) {
                userDictionary[user.userId] = user;
            }
            break;
        }

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
            state.userRegistrationStatus = UserRegistrationStatus.Registered;
            state.me = {...event.payload, imageBlobUrl: state.me?.imageBlobUrl ?? null};
            break;
        }

        case GET_CURRENT_USER_FAILED: {
            state.userRegistrationStatus = UserRegistrationStatus.NotRegistered;
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

        case MARK_REMOTE_USER_ONLINE: {
            const userId = event.payload;
            if (state.userDictionary.hasOwnProperty(userId)) {
                const user = state.userDictionary[userId] as UserSummary;
                if (user.minutesSinceLastOnline > 0) {
                    user.minutesSinceLastOnline = 0;
                    user.lastOnline = new Date();
                }
            }
            break;
        }

        case REGISTER_USER_SUCCEEDED: {
            state.userRegistrationStatus = UserRegistrationStatus.Registered;
            state.me = event.payload;
            break;
        }

        case REGISTER_USER_FAILED_USER_EXISTS: {
            state.userRegistrationStatus = UserRegistrationStatus.Registered;
            break;
        }

        case REGISTER_USER_FAILED_USERNAME_EXISTS: {
            state.userRegistrationStatus = UserRegistrationStatus.NotRegistered;
            break;
        }

        case UPDATE_MINUTES_SINCE_LAST_ONLINE: {
            for (const value of Object.values(state.userDictionary)) {
                const user = value as UserSummary;
                user.minutesSinceLastOnline = Math.floor(dateFunctions.getMinutesSince(user.lastOnline));
            }
            break;
        }

        case SET_PROFILE_IMAGE_REQUESTED: {
            const { imageId, blobUrl } = event.payload;
            const user = state.me;
            if (user != null) {
                user.imageId = imageId;
                user.imageBlobUrl = blobUrl;
            }
            break;
        }

        case SET_PROFILE_IMAGE_FAILED: 
        case SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED: {
            const { userId } = event.payload;
            const user = userId === state.me?.userId 
                ? state.me
                : (state.userDictionary.hasOwnProperty(userId) 
                    ? state.userDictionary[userId]
                    : null);

            URL.revokeObjectURL(user.imageBlobUrl);
            user.imageBlobUrl = null;
            user.imageId = null;
            break;
        }

        case SESSION_EXPIRED:
        case USER_LOGGED_OUT: {
            return initialState;
        }
    }
}, initialState);
