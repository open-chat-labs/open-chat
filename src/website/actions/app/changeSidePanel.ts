import { LeftPanelType, RightPanelType } from "../../domain/model/panels";

export const LEFT_PANEL_CHANGED = "LEFT_PANEL_CHANGED";
export const MIDDLE_PANEL_CHANGED = "MIDDLE_PANEL_CHANGED";
export const RIGHT_PANEL_CHANGED = "RIGHT_PANEL_CHANGED";

export function changeLeftPanel(sidePanel: LeftPanelType) {
    return {
        type: LEFT_PANEL_CHANGED,
        payload: sidePanel
    };
}

export function changeRightPanel(sidePanel: RightPanelType) {
    return {
        type: RIGHT_PANEL_CHANGED,
        payload: sidePanel
    };
}

export type LeftPanelChangedEvent = {
    type: typeof LEFT_PANEL_CHANGED,
    payload: LeftPanelType
}

export type RightPanelChangedEvent = {
    type: typeof RIGHT_PANEL_CHANGED,
    payload: RightPanelType
}

