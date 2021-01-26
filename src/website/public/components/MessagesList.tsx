import React, { Dispatch, useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { Option } from "../model/common";
import { LocalMessage, UnconfirmedMessage } from "../model/messages";
import { UserId, UserSummary } from "../model/users";
import { getSelectedChat } from "../utils/stateFunctions";

import DayChangeMarker from "./DayChangeMarker";
import MessageComponent, { MessageGroupPosition } from "./Message";
import { ConfirmedChat } from "../model/chats";
import { MIN_MESSAGE_ID, PAGE_SIZE } from "../constants";
import getMessages from "../actions/chats/getMessages";
import markMessageAsRead from "../actions/chats/markMessageAsRead";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export default React.memo(MessagesList);

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    if (chat === null) {
        return <div></div>;
    }

    const isGroupChat = chatFunctions.isGroupChat(chat);

    const children: JSX.Element[] = [];

    let unreadMessageIds = new Set<number>();
    if (chatFunctions.isConfirmedChat(chat)) {
        chat.unreadMessageIds.forEach(id => unreadMessageIds.add(id));
        chat.markAsReadPending.forEach(id => unreadMessageIds.delete(id));
    }

    // Ignore remote messages
    const messages = chat.messages.filter(m => m.kind !== "remote") as (LocalMessage | UnconfirmedMessage)[];

    // Determine which messages should be grouped with the previous message
    const messagesToGroup: boolean[] = [];
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
        const message = messages[i];

        let sentByMe: boolean;
        let senderUserId: UserId;
        let senderDetails: Option<UserSummary> = null;
        let unread: boolean = false;
        if (message.kind === "unconfirmed") {
            sentByMe = true;
            senderUserId = myUserId;
        } else {
            sentByMe = message.sender === myUserId;
            senderUserId = message.sender;
            unread = unreadMessageIds.has(message.id);
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
            id={message.key}
            content={message.content}
            dateConfirmed={message.kind === "unconfirmed" ? null : message.date}
            sentByMe={sentByMe}
            sender={senderDetails}
            unread={unread}
            groupPosition={groupPosition} />);
    }

    let className = "detail";

    if ("subject" in chat) {
        className += " group";
    }

    const dispatch = useDispatch();
    const messagesRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const messagesDiv = messagesRef.current;
        if (!messagesDiv || !chatFunctions.isConfirmedChat(chat)) {
            return;
        }

        // Set the scroll top or scroll bottom to maintain the previously saved scroll position
        if (chat.scrollTop !== null) {
            messagesDiv.scrollTop = chat.scrollTop;
        } else if (chat.scrollBottom !== null) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight - messagesDiv.clientHeight - chat.scrollBottom;
        }

        const onScroll = (e: Event) => onMessagesScroll(chat, e.target as HTMLElement, dispatch);
        messagesDiv.addEventListener("scroll", onScroll);

        return () => messagesDiv.removeEventListener("scroll", onScroll);
    }, [chat, messagesRef.current])

    return (
        <div id="messages" ref={messagesRef} className={className}>
            {children}
        </div>
    );
}

function onMessagesScroll(chat: ConfirmedChat, messagesDiv: HTMLElement, dispatch: Dispatch<any>) {
    const downloadMoreMessages =
        !chat.messagesDownloading.length &&
        chat.earliestConfirmedMessageId !== null &&
        chat.earliestConfirmedMessageId > MIN_MESSAGE_ID &&
        messagesDiv.scrollTop < 200;

    if (downloadMoreMessages) {
        const fromId = Math.max(chat.earliestConfirmedMessageId! - PAGE_SIZE, MIN_MESSAGE_ID);
        const count = chat.earliestConfirmedMessageId! - fromId;
        dispatch(getMessages(chat.chatId, fromId, count));
    }

    // Find any unread messages which are visible and mark them as read
    const substringStart = "message-".length;
    const outerBox = messagesDiv.getBoundingClientRect();
    const min = outerBox.top - 5;
    const max = outerBox.bottom - 30;
    for (const child of messagesDiv.children) {
        const box = child.getBoundingClientRect();
        if (box.top < min) {
            continue;
        } else if (box.top > max) {
            break;
        }
        if (child.classList.contains("unread")) {
            dispatch(markMessageAsRead(chat.chatId, parseInt(child.id.substring(substringStart))));
        }
    }
}
