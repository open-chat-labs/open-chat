import produce from "immer";

import {
    SidePanelType,
    SIDE_PANEL_CHANGED,
    SidePanelChangedEvent,
} from "../actions/changeSidePanel";

export type SidePanelState = {
    leftPanel: SidePanelType    
}

const initialState: SidePanelState = {
    leftPanel: SidePanelType.Chats
};

type Event = SidePanelChangedEvent ;

export default produce((state: SidePanelState, event: Event) => {
    switch (event.type) {
        case SIDE_PANEL_CHANGED: {
            state.leftPanel = event.payload;
            break;
        }
    }
}, initialState);
