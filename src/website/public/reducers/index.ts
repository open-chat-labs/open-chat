import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";

const rootReducer = combineReducers({
    chatsState: chatsReducer,
    usersState: usersReducer
});

export default rootReducer;

export type RootState = {
    chatsState: ChatsState,
    usersState: UsersState
};
