import { combineReducers } from "redux";

import chatsReducer, { ChatsState } from "./chatsReducer";
import usersReducer, { UsersState } from "./usersReducer";
import blobsReducer, { BlobsState } from "./blobsReducer";
import sidePanelReducer, { SidePanelState } from "./sidePanelReducer";

const rootReducer = combineReducers({
    blobsState: blobsReducer,
    chatsState: chatsReducer,
    usersState: usersReducer,
    sidePanelState: sidePanelReducer,
});

export default rootReducer;

export type RootState = {
    blobsState: BlobsState,
    chatsState: ChatsState,
    usersState: UsersState,
    sidePanelState: SidePanelState
};
