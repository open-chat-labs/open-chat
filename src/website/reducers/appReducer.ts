import produce from "immer";
import { USER_LOGGED_OUT, UserLoggedOutEvent } from "../actions/signin/logout";
import { THEME_SELECTED, ThemeSelectedEvent } from "../actions/selectTheme";
import SelectedThemeCache from "../domain/SelectedThemeCache";
import { Option } from "../domain/model/common";
import { LeaveGroupResult } from "../services/chats/leaveGroup";
import { AlertContent } from "../components/AlertDialog";

import {
    LEAVE_GROUP_FAILED,
    LeaveGroupFailedEvent
} from "../actions/chats/leaveGroup";

import {
    CLOSE_ALERT_DIALOG_REQUESTED,
    SHOW_ALERT_DIALOG_REQUESTED,
    CloseAlertDialogRequestedEvent,
    ShowAlertDialogRequestedEvent
} from "../actions/showAlertDialog";

import {
    SESSION_EXPIRED,
    SessionExpiredEvent
} from "../actions/signin/notifySessionExpired";

import {
    CREATE_GROUP_CHAT_FAILED,
    CreateGroupChatFailedEvent
} from "../actions/chats/createGroupChat";

import {
    GET_CURRENT_USER_FAILED,
    GET_CURRENT_USER_SUCCEEDED,
    GetCurrentUserFailedEvent,
    GetCurrentUserSucceededEvent
} from "../actions/users/getCurrentUser";

export enum SelectedTheme {
    SystemDefault,
    Light,
    Dark
}

export type AppState = {
    sessionExpired: boolean,
    selectedTheme: SelectedTheme,
    alert: Option<AlertContent>
}

const initialState: AppState = {
    sessionExpired: false,
    selectedTheme: SelectedThemeCache.tryGet() ?? SelectedTheme.SystemDefault,
    alert: null
}

type Event =
    CloseAlertDialogRequestedEvent |
    CreateGroupChatFailedEvent |
    ShowAlertDialogRequestedEvent |
    GetCurrentUserFailedEvent |
    GetCurrentUserSucceededEvent |
    LeaveGroupFailedEvent |
    SessionExpiredEvent |
    ThemeSelectedEvent | 
    UserLoggedOutEvent;

export default produce((state: AppState, event: Event) => {
    switch (event.type) {
        case THEME_SELECTED: {
            const selectedTheme = event.payload;
            state.selectedTheme = selectedTheme;
            SelectedThemeCache.set(selectedTheme);
            break;
        }

        case USER_LOGGED_OUT: {
            return initialState;
        }

        case LEAVE_GROUP_FAILED: {
            let alert = {
                title: "Failed to leave group",                
            };

            if (event.payload.result === LeaveGroupResult.LastAdminCannotLeave) {
                state.alert = { 
                    ...alert, 
                    message: "You can't leave the group because you are the only administrator"
                };
            } else {
                state.alert = { 
                    ...alert, 
                    message: "Unexpected error - please refresh the page"
                };
            }
            break;
        }

        case SHOW_ALERT_DIALOG_REQUESTED: {
            state.alert = event.payload;
            break;
        }

        case CLOSE_ALERT_DIALOG_REQUESTED: {
            state.alert = null;
            break;
        }

        case SESSION_EXPIRED: {
            state.sessionExpired = false;
            state.alert = {
                title: "Session Expired",
                message: "Your session has expired - please sign-in again"
            };
            break;
        }

        case CREATE_GROUP_CHAT_FAILED: {
            let message;
            switch (event.payload.response.kind) {
                case "subjectTooLong":
                    message = `The group name must be at most ${event.payload.response.result} characters long`;
                    break;
                case "subjectTooShort":
                    message = `The group name must be at least ${event.payload.response.result} characters long`;
                    break;
                case "tooManyParticipants":
                    message = `You can only have ${event.payload.response.result} participants in a group`;
                    break;
                default:
                    message = "Unexpected error - please refresh the page";
                    break;
            }

            state.alert = {
                title: "Create group chat failed",
                message
            };
            break;
        }

        case GET_CURRENT_USER_FAILED:
        case GET_CURRENT_USER_SUCCEEDED: {
            state.sessionExpired = false;
            break;
        }
    }
}, initialState);
