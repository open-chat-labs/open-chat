import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { Option } from "../model/common";
import { MessageContent } from "../model/messages";
import { UserId, UserSummary } from "../model/users";
import { getSelectedChat } from "../utils/stateFunctions";

import DayChangeMarker from "./DayChangeMarker";
import Message from "./Message";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export default React.memo(MessagesList);

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector(getSelectedChat);

    if (chat === null) {
        return <div></div>;
    }

    const isGroupChat = chatFunctions.isGroupChat(chat);

    const children: JSX.Element[] = [];

    let lastSeenDate: Option<Date> = null;
    let lastSeenDayString: Option<string> = null;
    let prevMessageSender: Option<UserId> = null;
    for (const message of chat.messages) {
        if (message.kind === "remote") {
            continue;
        }

        let sentByMe: boolean;
        let senderUserId: UserId;
        let senderDetails: Option<UserSummary> = null;
        if (message.kind === "unconfirmed") {
            sentByMe = true;
            senderUserId = myUserId;
        } else {
            sentByMe = message.sender === myUserId;
            senderUserId = message.sender;
            if (isGroupChat && !sentByMe) {
                senderDetails = usersDictionary.hasOwnProperty(message.sender)
                    ? usersDictionary[message.sender]
                    : {
                        userId: message.sender,
                        username: "Unknown",
                        version: 0
                    };
            }
        }

        const dayString = message.date.toDateString();
        if (lastSeenDayString === null || lastSeenDayString !== dayString) {
            children.push(<DayChangeMarker key={dayString} date={message.date} />);
        }

        const mergeWithPrevious: boolean =
            lastSeenDate !== null &&
            senderUserId === prevMessageSender &&
            message.date.getTime() - lastSeenDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

        children.push(<Message
            key={message.key}
            content={message.content}
            dateConfirmed={message.kind === "unconfirmed" ? null : message.date}
            sentByMe={sentByMe}
            sender={senderDetails}
            mergeWithPrevious={mergeWithPrevious} />);

        lastSeenDate = message.date;
        lastSeenDayString = dayString;
        prevMessageSender = senderUserId;
    }

    return (
        <div id="messages" className="detail">
            {children}
        </div>
    );
}
