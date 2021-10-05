import produce from "immer";
import { USER_LOGGED_OUT, UserLoggedOutEvent } from "../actions/signin/logout";
import { THEME_SELECTED, ThemeSelectedEvent } from "../actions/app/selectTheme";
import SelectedThemeCache from "../domain/SelectedThemeCache";
import { LeaveGroupResult } from "../services/chats/leaveGroup";
import { SelectedTheme } from "../domain/model/theme";
import { ViewMode } from "../domain/model/viewMode";
import { alertDialog } from "../components/modals/Alert";

import {
    LEAVE_GROUP_FAILED,
    LeaveGroupFailedEvent
} from "../actions/chats/leaveGroup";

import {
    SESSION_EXPIRED, SESSION_EXPIRY_ACKNOWLEDGED,
    SessionExpiredEvent, SessionExpiryAcknowledgedEvent
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

import {
    SWITCH_VIEW_MODE_REQUESTED,
    SwitchViewModeRequestedEvent
} from "../actions/app/switchViewMode";

import {
    LEFT_PANEL_CHANGED,
    LeftPanelChangedEvent,
    RIGHT_PANEL_CHANGED,
    RightPanelChangedEvent,
} from "../actions/app/changeSidePanel";

import { GOTO_CHAT, GotoChatEvent } from "../actions/chats/gotoChat";
import { CREATE_GROUP_CHAT_REQUESTED, CreateGroupChatRequestedEvent } from "../actions/chats/createGroupChat";
import { DIRECT_CHAT_CREATED, DirectChatCreatedEvent } from "../actions/chats/gotoUser";
import { LeftPanelType, MiddlePanelType, PanelState, RightPanelType } from "../domain/model/panels";
import { GotoHomeEvent, GOTO_HOME } from "../actions/app/gotoHome";
import { GetAllChatsSucceededEvent, GET_ALL_CHATS_SUCCEEDED } from "../actions/chats/getAllChats";
import { 
    START_SPINNING,
    STOP_SPINNING,
    StartSpinningEvent,
    StopSpinningEvent
} from "../actions/app/modalSpinner";

export type AppState = {
    sessionExpired: boolean,
    selectedTheme: SelectedTheme,
    viewMode: ViewMode,
    panelState: PanelState,
    modalSpinner: boolean,
}

const initialState: AppState = {
    sessionExpired: false,
    selectedTheme: SelectedThemeCache.tryGet() ?? SelectedTheme.SystemDefault,
    viewMode: ViewMode.Desktop,
    panelState: {
        leftPanel: LeftPanelType.Chats,
        middlePanel: MiddlePanelType.Messages,
        rightPanel: RightPanelType.None
    } ,
    modalSpinner: false,
}

type Event =
    CreateGroupChatFailedEvent |
    CreateGroupChatRequestedEvent | 
    DirectChatCreatedEvent |
    GetAllChatsSucceededEvent |
    GetCurrentUserFailedEvent |
    GetCurrentUserSucceededEvent |
    GotoChatEvent |
    GotoHomeEvent |
    LeaveGroupFailedEvent |
    LeftPanelChangedEvent | 
    RightPanelChangedEvent | 
    SessionExpiredEvent |
    SessionExpiryAcknowledgedEvent |
    StartSpinningEvent |
    StopSpinningEvent |
    SwitchViewModeRequestedEvent |
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

        case LEAVE_GROUP_FAILED: {
            let text;

            if (event.payload.result === LeaveGroupResult.LastAdminCannotLeave) {
                text = "You can't leave the group because you are the only administrator";
            } else {
                text = "Unexpected error - please refresh the page";
            }

            alertDialog({
                title: "Failed to leave group",
                text
            });                    

            break;
        }

        case USER_LOGGED_OUT: {
            return initialState;
        }

        case SESSION_EXPIRED: {
            return { ...initialState, sessionExpired: true };
        }

        case SESSION_EXPIRY_ACKNOWLEDGED: {
            state.sessionExpired = false;
            break;
        }

        case CREATE_GROUP_CHAT_REQUESTED:
        case DIRECT_CHAT_CREATED: {
            state.panelState.rightPanel = RightPanelType.None;
            if (state.viewMode === ViewMode.Mobile) {
                state.panelState.middlePanel = MiddlePanelType.Messages;
                state.panelState.leftPanel = LeftPanelType.None;
            }
            break;
        }

        case CREATE_GROUP_CHAT_FAILED: {
            let text;
            switch (event.payload.response.kind) {
                case "subjectTooLong":
                    text = `The group name must be at most ${event.payload.response.result} characters long`;
                    break;
                case "subjectTooShort":
                    text = `The group name must be at least ${event.payload.response.result} characters long`;
                    break;
                case "tooManyParticipants":
                    text = `You can only have ${event.payload.response.result} participants in a group`;
                    break;
                default:
                    text = "Unexpected error - please refresh the page";
                    break;
            }

            alertDialog({
                title: "Create group chat failed",
                text
            });                    

            break;
        }

        case GET_CURRENT_USER_FAILED:
        case GET_CURRENT_USER_SUCCEEDED: {
            state.sessionExpired = false;
            break;
        }

        case SWITCH_VIEW_MODE_REQUESTED: {
            const { viewMode, isChatSelected } = event.payload;
            state.viewMode = viewMode;
            if (viewMode === ViewMode.Desktop) {
                state.panelState.middlePanel = MiddlePanelType.Messages;
                state.panelState.leftPanel = LeftPanelType.Chats;
            } else if (viewMode === ViewMode.Mobile) {
                state.panelState.middlePanel = MiddlePanelType.None;
                state.panelState.leftPanel = LeftPanelType.None;
                if (state.panelState.rightPanel === RightPanelType.None) {
                    if (isChatSelected) {
                        state.panelState.middlePanel = MiddlePanelType.Messages;
                    } else {
                        state.panelState.leftPanel = LeftPanelType.Chats;
                    }
                } 
            }
            break;
        }

        case GOTO_HOME: {
            state.panelState.leftPanel = LeftPanelType.Chats;
            state.panelState.rightPanel = RightPanelType.None;
            if (state.viewMode === ViewMode.Mobile) {
                state.panelState.middlePanel = MiddlePanelType.None;
            }
            break;
        }

        case GET_ALL_CHATS_SUCCEEDED: {
            const { selectedChatIndex } = event.payload;
            if (state.viewMode === ViewMode.Mobile) {
                if (selectedChatIndex != null) {
                    state.panelState.leftPanel = LeftPanelType.None;
                    state.panelState.middlePanel = MiddlePanelType.Messages;    
                }
            }
            break;
        }

        case LEFT_PANEL_CHANGED: {
            state.panelState.leftPanel = event.payload;
            if (state.viewMode === ViewMode.Mobile) {
                state.panelState.rightPanel = RightPanelType.None;
                if (state.panelState.leftPanel === LeftPanelType.None) {
                    state.panelState.middlePanel = MiddlePanelType.Messages;
                } else {
                    state.panelState.middlePanel = MiddlePanelType.None;
                }
            }
            break;
        }
        
        case RIGHT_PANEL_CHANGED: {
            state.panelState.rightPanel = event.payload;
            if (state.viewMode === ViewMode.Mobile) {
                state.panelState.leftPanel = LeftPanelType.None;
                if (state.panelState.rightPanel === RightPanelType.None) {
                    state.panelState.middlePanel = MiddlePanelType.Messages;
                } else {
                    state.panelState.middlePanel = MiddlePanelType.None;
                }     
            }
            break;
        }

        case GOTO_CHAT: {
            const { chatIndex } = event.payload;
            state.panelState.rightPanel = RightPanelType.None;
            if (chatIndex != null && state.viewMode === ViewMode.Mobile) {
                state.panelState.middlePanel = MiddlePanelType.Messages;
                state.panelState.leftPanel = LeftPanelType.None;
            }
            break;
        }

        case START_SPINNING: {
            state.modalSpinner = true;
            break;
        }

        case STOP_SPINNING: {
            state.modalSpinner = false;
            break;
        }
    }
}, initialState);
