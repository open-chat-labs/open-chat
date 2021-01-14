import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import { DirectChat } from "../model/chats";
import { Option } from "../model/common";
import { UserId } from "../model/users";

import DayChangeMarker from "./messages/DayChangeMarker";
import DirectMessageSentByThem from "./messages/DirectMessageSentByThem";
import GroupMessageSentByElse from "./messages/GroupMessageSentByElse";
import MessageSentByMe from "./messages/MessageSentByMe";
import UnconfirmedMessage from "./messages/UnconfirmedMessage";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export default MessagesList;

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chatsState = useSelector((state: RootState) => state.chatsState);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    const children: JSX.Element[] = [];

    let lastSeenDate: Option<Date> = null;
    let lastSeenDayString: Option<string> = null;
    let prevMessageSender: Option<UserId> = null;
    for (let i = 0; i < chat.messages.length; i++) {
        const message = chat.messages[i];
        if (message.kind === "remote") {
            continue;
        } else if (message.kind === "unconfirmed") {
            const now = new Date();
            const dayString = now.toDateString();
            if (lastSeenDayString === null || lastSeenDayString !== dayString) {
                children.push(<DayChangeMarker key={dayString} date={now} />);
            }

            const mergeWithPrevious: boolean =
                lastSeenDate !== null &&
                (prevMessageSender === null || prevMessageSender === myUserId) &&
                now.getTime() - lastSeenDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

            const props = {
                message: message.text,
                mergeWithPrevious
            };
            children.push(<UnconfirmedMessage key={"u-" + i} {...props} />);

            lastSeenDate = now;
            lastSeenDayString = dayString;
            prevMessageSender = myUserId;
        } else {
            const dayString = message.date.toDateString();
            if (lastSeenDayString === null || lastSeenDayString !== dayString) {
                children.push(<DayChangeMarker key={dayString} date={message.date} />);
            }

            const mergeWithPrevious: boolean =
                lastSeenDate !== null &&
                message.sender === prevMessageSender &&
                message.date.getTime() - lastSeenDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

            const sentByMe = message.sender === myUserId;
            if (sentByMe) {
                const props = {
                    message: message.text,
                    date: message.date,
                    confirmed: true,
                    mergeWithPrevious
                };
                children.push(<MessageSentByMe key={message.id} {...props} />);
            } else if (chat.kind === "direct") {
                const props = {
                    message: message.text,
                    date: message.date,
                    mergeWithPrevious
                };
                children.push(<DirectMessageSentByThem key={message.id} {...props} />);
            } else {
                const props = {
                    message: message.text,
                    date: message.date,
                    senderUsername: usersDictionary.hasOwnProperty(message.sender)
                        ? usersDictionary[message.sender]
                        : "",
                    mergeWithPrevious
                };
                children.push(<GroupMessageSentByElse key={message.id} {...props} />);
            }
            lastSeenDate = message.date;
            lastSeenDayString = dayString;
            prevMessageSender = message.sender;
        }
    }

    return (
        <div id="messages" className="detail">
            {children}
        </div>
    );
}
