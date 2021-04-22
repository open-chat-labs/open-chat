import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../reducers";
import { getSelectedChat } from "../../domain/stateFunctions";
import * as chatFunctions from "../../domain/model/chats";
import { cancelReplyToMessage } from "../../actions/chats/replyToMessage";
import CloseButton from "../shared/CloseButton";

export default React.memo(ReplyToMessagePanel);

function ReplyToMessagePanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    let panel = null;
    if (chat && chatFunctions.isConfirmedChat(chat) && chat.replyToMessageId) {
        panel = <div>
            Reply to message {chat.replyToMessageId}
            <CloseButton onClick={closePanel} />
        </div>;
    }

    function closePanel() {
        dispatch(cancelReplyToMessage(chat!.chatId));
    }

    return (
        <>
            {panel}
        </>
    );
}