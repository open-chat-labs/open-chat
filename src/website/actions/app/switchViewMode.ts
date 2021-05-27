import { Dispatch } from "react";
import { ViewMode } from "src/website/domain/model/viewMode";
import { RootState } from "../../reducers";

export const SWITCH_VIEW_MODE_REQUESTED = "SWITCH_VIEW_MODE_REQUESTED";

export default function(viewMode: ViewMode) {
    return (dispatch: Dispatch<any>, getState: () => RootState) => {
        const selectedChatIndex = getState().chatsState.selectedChatIndex;
        const event: SwitchViewModeRequestedEvent = {
            type: SWITCH_VIEW_MODE_REQUESTED,
            payload: {
                viewMode,
                isChatSelected: selectedChatIndex != null
            }
        };
        dispatch(event);
    };
}

export type SwitchViewModeRequestedEvent = {
    type: typeof SWITCH_VIEW_MODE_REQUESTED,
    payload: SwitchViewPaylod
}

export type SwitchViewPaylod = {
    viewMode: ViewMode,
    isChatSelected: boolean
}