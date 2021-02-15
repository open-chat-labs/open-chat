export const SIDE_PANEL_CHANGED = "SIDE_PANEL_CHANGED";

export default function(sidePanel: SidePanelType) {
    return {
        type: SIDE_PANEL_CHANGED,
        payload: sidePanel
    };
}

export type SidePanelChangedEvent = {
    type: typeof SIDE_PANEL_CHANGED,
    payload: SidePanelType
}

export enum SidePanelType {
    Chats,
    NewDirectChat
}

