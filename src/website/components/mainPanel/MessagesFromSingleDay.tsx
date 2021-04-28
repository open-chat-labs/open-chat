import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import { Message, RemoteMessage } from "../../domain/model/messages";
import { UserId, UserSummary } from "../../domain/model/users";
import DayChangeMarker from "./DayChangeMarker";
import MessageComponent, { MessageGroupPosition } from "./Message";
import { getStartOfDay } from "../../utils/dateFunctions";
import UnreadMessageDetector from "../../domain/UnreadMessageDetector";
import { ChatId } from "../../domain/model/chats";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

type Props = {
    chatId: Option<ChatId>,
    isGroupChat: boolean,
    myUserId: UserId,
    theirUserId: Option<UserId>,
    usersDictionary: any,
    messages: (Exclude<Message, RemoteMessage>)[],
    unreadMessageDetector: UnreadMessageDetector,
    messageIdToSelect: Option<number>
}

export default React.memo(MessagesFromSingleDay);

const useStyles = makeStyles((theme: Theme) => ({
    dayContainer: {
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        paddingBottom: 14
    }
}));

function MessagesFromSingleDay(props: Props) {
    const classes = useStyles();

    const theirUsername = (props.theirUserId && props.usersDictionary.hasOwnProperty(props.theirUserId)) 
        ? props.usersDictionary[props.theirUserId].username
        : null;

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
        let readByMe: boolean = true;
        if (message.kind === "unconfirmed") {
            sentByMe = true;
            senderUserId = props.myUserId;
        } else {
            sentByMe = message.sender === props.myUserId;
            senderUserId = message.sender;
            readByMe = !props.unreadMessageDetector.isUnread(message);

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

        const readByThem = !props.unreadMessageDetector.isUnreadByThem(message);

        const repliesToUserId = message.repliesTo?.userId;
        const repliesToContent = message.repliesTo?.content ?? null;
        const repliesToMyMessage = props.myUserId === repliesToUserId;

        const repliesToUsername = repliesToUserId && !repliesToMyMessage && props.usersDictionary.hasOwnProperty(repliesToUserId)
            ? props.usersDictionary[repliesToUserId].username
            : null;

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

        const messageId = "id" in message ? message.id : null;
        const selectEffect = messageId != null && props.messageIdToSelect != null && messageId === props.messageIdToSelect;

        children.push(<MessageComponent
            key={message.clientMessageId}
            chatId={props.chatId}
            messageId={messageId}
            userId={senderUserId}
            clientMessageId={message.clientMessageId}
            content={message.content}
            date={message.date}
            isGroupChat={props.isGroupChat}
            sentByMe={sentByMe}
            sender={senderDetails}
            theirUsername={theirUsername}
            confirmed={message.kind !== "unconfirmed"}
            readByMe={readByMe}
            readByThem={readByThem}
            groupPosition={groupPosition}
            repliesToContent={repliesToContent}
            repliesToChatId={message.repliesTo?.chatId ?? null}
            repliesToMessageId={message.repliesTo?.messageId ?? null}
            repliesToMyMessage={repliesToMyMessage}
            repliesToUsername={repliesToUsername}
            selectEffect={selectEffect} />);
    }

    return (
        <div className={classes.dayContainer}>
            {children}
        </div>
    );
}
