import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { Option } from "../model/common";
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
    for (let i = 0; i < chat.messages.length; i++) {
        const message = chat.messages[i];
        if (message.kind === "remote") {
            continue;
        }

        if (message.kind === "unconfirmed") {
            const now = new Date();
            const dayString = now.toDateString();
            if (lastSeenDayString === null || lastSeenDayString !== dayString) {
                children.push(<DayChangeMarker key={dayString} date={now} />);
            }

            const mergeWithPrevious: boolean =
                lastSeenDate !== null &&
                (prevMessageSender === null || prevMessageSender === myUserId) &&
                now.getTime() - lastSeenDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

            children.push(<Message
                key={message.key}
                content={message.content}
                sentByMe={true}
                mergeWithPrevious={mergeWithPrevious} />);

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

            let sender: UserSummary | undefined;

            const sentByMe = message.sender === myUserId;
            if (isGroupChat && !sentByMe) {
                sender = usersDictionary.hasOwnProperty(message.sender)
                    ? usersDictionary[message.sender]
                    : {
                        userId: message.sender,
                        username: "Unknown",
                        version: 0
                    };
            }

            children.push(<Message
                key={message.key}
                content={message.content}
                date={message.date}
                sentByMe={sentByMe}
                sender={sender}
                mergeWithPrevious={mergeWithPrevious} />);

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
