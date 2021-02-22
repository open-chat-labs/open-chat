import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";
import sidePanelReducer, { SidePanelState } from "./sidePanelReducer";

const rootReducer = combineReducers({
    chatsState: chatsReducer,
    usersState: usersReducer,
    sidePanelState: sidePanelReducer,
});

export default rootReducer;

export type RootState = {
    chatsState: ChatsState,
    usersState: UsersState,
    sidePanelState: SidePanelState
};
