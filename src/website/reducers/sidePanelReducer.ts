import produce from "immer";

import {
    LeftPanelType,
    RightPanelType,
    LEFT_PANEL_CHANGED,
    RIGHT_PANEL_CHANGED,
    LeftPanelChangedEvent,
    RightPanelChangedEvent,
} from "../actions/changeSidePanel";

import { CHAT_SELECTED, ChatSelectedEvent } from "../actions/chats/selectChat";
import { CREATE_GROUP_CHAT_REQUESTED, CreateGroupChatRequestedEvent } from "../actions/chats/createGroupChat";
import { SETUP_NEW_DIRECT_CHAT_SUCCEEDED, SetupNewDirectChatSucceededEvent } from "../actions/chats/gotoUser";

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
    ChatSelectedEvent | 
    CreateGroupChatRequestedEvent | 
    SetupNewDirectChatSucceededEvent;

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
        case CHAT_SELECTED:
        case CREATE_GROUP_CHAT_REQUESTED:
        case SETUP_NEW_DIRECT_CHAT_SUCCEEDED: {
            state.rightPanel = RightPanelType.None;
            break;
        }
    }
}, initialState);
