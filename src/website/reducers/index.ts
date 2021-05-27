import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";
import appReducer, { AppState } from "./appReducer";

const rootReducer = combineReducers({
    appState: appReducer,
    usersState: usersReducer,
    chatsState: chatsReducer
});

export default rootReducer;

export type RootState = {
    appState: AppState,
    usersState: UsersState,
    chatsState: ChatsState,
};
