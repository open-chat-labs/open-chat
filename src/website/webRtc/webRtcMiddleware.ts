import { Middleware } from "redux";
import { RootState } from "../reducers";
import { SEND_MESSAGE_REQUESTED, SendMessageRequestedEvent} from "../actions/chats/sendMessage";
import * as chatFunctions from "../model/chats";
import RtcConnectionHandler from "./RtcConnectionHandler";

const webRtcMiddleware : Middleware<{}, RootState> = store => next => event => {
    if (event.type === SEND_MESSAGE_REQUESTED) {
        const { chat, clientMessageId, content } = (event as SendMessageRequestedEvent).payload;
        if (chatFunctions.isConfirmedChat(chat)) {
            const myUserId = store.getState().usersState.me!.userId;
            RtcConnectionHandler.sendMessage(chat, clientMessageId, content, myUserId);
        }
    }

    return next(event);
}

export default webRtcMiddleware;
