import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { Option } from "../model/common";
import { LocalMessage, Message, MessageContent, RemoteMessage, UnconfirmedMessage } from "../model/messages";
import { UserId, UserSummary } from "../model/users";
import { getSelectedChat } from "../utils/stateFunctions";

import DayChangeMarker from "./DayChangeMarker";
import MessageComponent, { MessageGroupPosition } from "./Message";

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

    // Ignore remote messages
    const messages = chat.messages.filter(m => m.kind !== "remote") as (LocalMessage | UnconfirmedMessage)[];

    // Determine which messages should be grouped with the previous message
    let messagesToGroup: boolean[] = [];
    let lastSeenDate: Option<Date> = null;
    let prevMessageSender: Option<UserId> = null;
    for (const message of messages) {
        const senderUserId: UserId = message.kind === "unconfirmed" ? myUserId : message.sender;
        const groupWithPrevious: boolean =
            lastSeenDate !== null &&
            senderUserId === prevMessageSender &&
            message.date.getTime() - lastSeenDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

        messagesToGroup.push(groupWithPrevious);
        lastSeenDate = message.date;
        prevMessageSender = senderUserId;
    }

    // Loop through messages and add components
    for (let i = 0; i < messages.length; i++) {
        let message = messages[i];

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
        const prevDayString = i > 0 ? messages[i-1].date.toDateString() : null;
        if (prevDayString === null || prevDayString !== dayString) {
            children.push(<DayChangeMarker key={dayString} date={message.date} />);
        }

        // Determine whether the message should be grouped with others and if so whether it is
        // at the top, middle, or bottom of the group
        const groupWithPrevious = messagesToGroup[i];
        const groupWithNext = i < messages.length - 1 ? messagesToGroup[i+1] : false;
        let groupPosition: MessageGroupPosition = MessageGroupPosition.None;
        if (!groupWithPrevious && groupWithNext) {
            groupPosition = MessageGroupPosition.Top;
        } else if (groupWithPrevious && groupWithNext) {
            groupPosition = MessageGroupPosition.Middle;
        } else if (groupWithPrevious && !groupWithNext) {
            groupPosition = MessageGroupPosition.Bottom;
        }

        children.push(<MessageComponent
            key={message.key}
            content={message.content}
            dateConfirmed={message.kind === "unconfirmed" ? null : message.date}
            sentByMe={sentByMe}
            sender={senderDetails}
            groupPosition={groupPosition} />);
    }

    let className = "detail";

    if ("subject" in chat) {
        className += " group";
    }

    return (
        <div id="messages" className={className}>
            {children}
        </div>
    );
}
