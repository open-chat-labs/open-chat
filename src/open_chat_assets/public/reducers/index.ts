import { combineReducers } from "redux";

import chatsReducer from "./chatsReducer";
import usersReducer from "./usersReducer";

const rootReducer = combineReducers({
  chatsState: chatsReducer,
  usersState: usersReducer
});

export default rootReducer;

export type RootState = ReturnType<typeof rootReducer>;
