import { Dispatch } from "react";
import { RootState } from "../../reducers";
import { ViewMode } from "../../domain/model/viewMode";
import * as historyFunctions from "../../domain/historyFunctions";
import { gotoChatByIndex } from "../chats/gotoChat";

export const GOTO_HOME = "GOTO_HOME";

export default function() {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {
        if (getState().appState.viewMode == ViewMode.Desktop) {
            const selectedChatIndex = getState().chatsState.selectedChatIndex;
            if (selectedChatIndex != null) {
                const chats = getState().chatsState.chats;
                const selectedChat = chats[selectedChatIndex];
                historyFunctions.pushOrReplaceChat(selectedChat.chatId, false);
            } else {
                dispatch(gotoChatByIndex(0));
            }
        } else {
            dispatch({ type: GOTO_HOME });
        }    
    }
}

export type GotoHomeEvent = {
    type: typeof GOTO_HOME
}
