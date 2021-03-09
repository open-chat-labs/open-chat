import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";
import sidePanelReducer, { SidePanelState } from "./sidePanelReducer";
import themeReducer, { ThemeState } from "./themeReducer";

const rootReducer = combineReducers({
    chatsState: chatsReducer,
    usersState: usersReducer,
    sidePanelState: sidePanelReducer,
    themeState: themeReducer
});

export default rootReducer;

export type RootState = {
    chatsState: ChatsState,
    usersState: UsersState,
    sidePanelState: SidePanelState,
    themeState: ThemeState
};
