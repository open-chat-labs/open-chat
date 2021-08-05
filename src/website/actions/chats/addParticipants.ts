import { Dispatch } from "react";
import chatsService from "../../services/chats/service";
import { UserId } from "../../domain/model/users";
import { ChatId, GroupChat } from "../../domain/model/chats";
import { UNCONFIRMED_GROUP_CHAT } from "../../constants";
import Stopwatch from "../../utils/Stopwatch";
import { startSpinning, stopSpinning } from "../app/modalSpinner";
import { alertDialog } from "../../components/modals/Alert";
import * as setFunctions from "../../utils/setFunctions";

export const ADD_PARTICIPANTS_SUCCEEDED = "ADD_PARTICIPANTS_SUCCEEDED";

export default function(chat: GroupChat, userIds: UserId[]) {
    return async (dispatch: Dispatch<any>) => {

        if (chat.kind === UNCONFIRMED_GROUP_CHAT)
            return;

        dispatch(startSpinning());
        
        const timer = Stopwatch.startNew();

        const response = await chatsService.addParticipants(chat.chatId, userIds);

        if (response.kind === "success" || response.kind === "partialSuccess") {
            let usersAdded = userIds;
            
            if (response.kind === "partialSuccess") {
                setFunctions.exceptWith(usersAdded, response.blocked);
                let text = "You can't add users if you are blocking them or they are blocking you";
                let title = "User not added";
                if (userIds.length > 1) {
                    if (response.countAdded == 0) {
                        title = "No users added";
                    } else {
                        title = `Only ${response.countAdded} users added`;
                    }
                }
                alertDialog({ title, text });
            }

            if (response.countAdded > 0) {
                dispatch({
                    type: ADD_PARTICIPANTS_SUCCEEDED,
                    payload: {
                        chatId: chat.chatId,
                        users: usersAdded,
                        durationMs: timer.getElapsedMs()
                    }
                } as AddParticipantsSucceededEvent);
            }
        } 

        dispatch(stopSpinning());
    };
}

export type AddParticipantsSucceededEvent = {
    type: typeof ADD_PARTICIPANTS_SUCCEEDED,
    payload: {
        chatId: ChatId,
        users: UserId[],
        durationMs: number
    }
}
