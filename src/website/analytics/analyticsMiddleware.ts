import { Middleware } from "redux";
import { RootState } from "../reducers";
import trackEvent from "./eventTracker";
import { ADD_PARTICIPANTS_REQUESTED, ADD_PARTICIPANTS_SUCCEEDED } from "../actions/chats/addParticipants";
import { CREATE_GROUP_CHAT_REQUESTED, CREATE_GROUP_CHAT_SUCCEEDED } from "../actions/chats/createGroupChat";
import { REMOVE_PARTICIPANT_REQUESTED, REMOVE_PARTICIPANT_SUCCEEDED } from "../actions/chats/removeParticipant";
import { SEND_MESSAGE_REQUESTED, SEND_MESSAGE_SUCCEEDED } from "../actions/chats/sendMessage";

const eventsToTrack = new Set<String>([
    ADD_PARTICIPANTS_REQUESTED,
    ADD_PARTICIPANTS_SUCCEEDED,
    CREATE_GROUP_CHAT_REQUESTED,
    CREATE_GROUP_CHAT_SUCCEEDED,
    REMOVE_PARTICIPANT_REQUESTED,
    REMOVE_PARTICIPANT_SUCCEEDED,
    SEND_MESSAGE_REQUESTED,
    SEND_MESSAGE_SUCCEEDED
]);

const analyticsMiddleware : Middleware<{}, RootState> = store => next => event => {
    if (eventsToTrack.has(event.type)) {
        trackEvent(event.type, event.payload);
    }
    return next(event);
}

export default analyticsMiddleware;
