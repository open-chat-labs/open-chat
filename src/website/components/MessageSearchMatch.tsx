import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChatId } from "../domain/model/chats";
import * as chatFunctions from "../domain/model/chats";
import * as stateFunctions from "../domain/stateFunctions";
import { LocalMessage } from "../domain/model/messages";
import { RootState } from "../reducers";
import selectChat from "../actions/chats/selectChat";
import { formatMessageDate } from "../formatters/date";
import TextContent from "./TextContent";
import { getContentAsText } from "../utils/messageFunctions";

export default React.memo(MessageSearchMatch);

type Props = {
    chatId: ChatId,
    message: LocalMessage,
    searchTerm: string
}

function MessageSearchMatch(props: Props) {
    const dispatch = useDispatch();

    const [chat, index] = useSelector((state: RootState) =>
        chatFunctions.getChatById(state.chatsState.chats, props.chatId));

    const userDictionary = useSelector((state: RootState) => state.usersState.userDictionary);

    let chatName: string;
    if (chatFunctions.isDirectChat(chat)) {
        chatName = stateFunctions.getUserSummary(chat.them, userDictionary)?.username ?? "";
    } else {
        chatName = chat.subject;
    }

    return (
        <li onClick={() => dispatch(selectChat(index, props.message.id))}>
            <div className="message-container">
                <div>
                    <div className="date">{formatMessageDate(props.message.date)}</div>
                    <div className="name">{chatName}</div>
                </div>
                <div>
                    <div className="chats-message">
                        <TextContent text={getContentAsText(props.message.content)} insertLineBreaks={false} />
                    </div>
                </div>
            </div>
        </li>
    );
}
