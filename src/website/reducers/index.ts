import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";
import sidePanelReducer, { SidePanelState } from "./sidePanelReducer";
import appReducer, { AppState } from "./appReducer";

const rootReducer = combineReducers({
    chatsState: chatsReducer,
    usersState: usersReducer,
    sidePanelState: sidePanelReducer,
    appState: appReducer
});

export default rootReducer;

export type RootState = {
    chatsState: ChatsState,
    usersState: UsersState,
    sidePanelState: SidePanelState,
    appState: AppState
};
