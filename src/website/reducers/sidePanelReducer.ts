import produce from "immer";

import {
    LEFT_PANEL_CHANGED,
    LeftPanelChangedEvent,
    LeftPanelType,
    RIGHT_PANEL_CHANGED,
    RightPanelChangedEvent,
    RightPanelType,
} from "../actions/changeSidePanel";

import { GOTO_CHAT, GotoChatEvent } from "../actions/chats/gotoChat";
import { CREATE_GROUP_CHAT_REQUESTED, CreateGroupChatRequestedEvent } from "../actions/chats/createGroupChat";
import { DIRECT_CHAT_CREATED, DirectChatCreatedEvent } from "../actions/chats/gotoUser";
import { USER_LOGGED_OUT, UserLoggedOutEvent } from "../actions/signin/logout";

export type SidePanelState = {
    leftPanel: LeftPanelType,
    rightPanel: RightPanelType,
}

const initialState: SidePanelState = {
    leftPanel: LeftPanelType.Chats,
    rightPanel: RightPanelType.None
};

type Event = 
    LeftPanelChangedEvent | 
    RightPanelChangedEvent | 
    CreateGroupChatRequestedEvent | 
    DirectChatCreatedEvent |
    GotoChatEvent | 
    UserLoggedOutEvent;

export default produce((state: SidePanelState, event: Event) => {
    switch (event.type) {
        case LEFT_PANEL_CHANGED: {
            state.leftPanel = event.payload;
            break;
        }
        case RIGHT_PANEL_CHANGED: {
            state.rightPanel = event.payload;
            break;
        }
        case GOTO_CHAT:
        case CREATE_GROUP_CHAT_REQUESTED:
        case DIRECT_CHAT_CREATED: {
            if (event.type !== GOTO_CHAT || event.payload.chatIndex != null) {
                state.rightPanel = RightPanelType.None;
            }
            break;
        }

        case USER_LOGGED_OUT: {
            return initialState;
        }
    }
}, initialState);
