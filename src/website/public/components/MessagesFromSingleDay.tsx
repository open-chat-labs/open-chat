import React from "react";

import { Option } from "../model/common";
import { LocalMessage, UnconfirmedMessage } from "../model/messages";
import { UserId, UserSummary } from "../model/users";

import DayChangeMarker from "./DayChangeMarker";
import MessageComponent, { MessageGroupPosition } from "./Message";
import { getStartOfDay } from "../utils/dateFunctions";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

type Props = {
    isGroupChat: boolean,
    myUserId: UserId,
    usersDictionary: any,
    messages: (LocalMessage | UnconfirmedMessage)[],
    unreadMessageIds: Set<number>
}

export default React.memo(MessagesFromSingleDay);

function MessagesFromSingleDay(props: Props) {
    // Determine which messages should be grouped with the previous message
    const messagesToGroup: boolean[] = [];
    let prevMessageSender: Option<UserId> = null;
    let lastMessageDate: Option<Date> = null;
    for (const message of props.messages) {
        const senderUserId: UserId = message.kind === "unconfirmed" ? props.myUserId : message.sender;
        const groupWithPrevious: boolean =
            lastMessageDate !== null &&
            senderUserId === prevMessageSender &&
            message.date.getTime() - lastMessageDate.getTime() < MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS;

        messagesToGroup.push(groupWithPrevious);
        lastMessageDate = message.date;
        prevMessageSender = senderUserId;
    }

    const children: JSX.Element[] = [];

    const startOfDay = getStartOfDay(props.messages[0].date);
    children.push(<DayChangeMarker key={startOfDay.toDateString()} date={startOfDay} />);

    // Loop through messages and add components
    for (let i = 0; i < props.messages.length; i++) {
        const message = props.messages[i];

        let sentByMe: boolean;
        let senderUserId: UserId;
        let senderDetails: Option<UserSummary> = null;
        let unread: boolean = false;
        if (message.kind === "unconfirmed") {
            sentByMe = true;
            senderUserId = props.myUserId;
        } else {
            sentByMe = message.sender === props.myUserId;
            senderUserId = message.sender;
            unread = props.unreadMessageIds.has(message.id);
            if (props.isGroupChat && !sentByMe) {
                senderDetails = props.usersDictionary.hasOwnProperty(message.sender)
                    ? props.usersDictionary[message.sender]
                    : {
                        userId: message.sender,
                        username: "Unknown",
                        version: 0
                    };
            }
        }

        // Determine whether the message should be grouped with others and if so whether it is
        // at the top, middle, or bottom of the group
        const groupWithPrevious = messagesToGroup[i];
        const groupWithNext = i < props.messages.length - 1 ? messagesToGroup[i+1] : false;
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
            id={message.key}
            content={message.content}
            dateConfirmed={message.kind === "unconfirmed" ? null : message.date}
            sentByMe={sentByMe}
            sender={senderDetails}
            unread={unread}
            groupPosition={groupPosition} />);
    }

    return (
        <div className="day-container">
            {children}
        </div>
    );
}
