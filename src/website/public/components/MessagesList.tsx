import React, { Dispatch, useEffect, useLayoutEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { Option } from "../model/common";
import { LocalMessage, UnconfirmedMessage } from "../model/messages";
import { UserId, UserSummary } from "../model/users";
import { getSelectedChat } from "../utils/stateFunctions";

import DayChangeMarker from "./DayChangeMarker";
import MessageComponent, { MessageGroupPosition } from "./Message";
import { ChatId, ConfirmedChat } from "../model/chats";
import { MIN_MESSAGE_ID, PAGE_SIZE } from "../constants";
import * as stateFunctions from "../utils/stateFunctions";
import getMessages from "../actions/chats/getMessages";

const MERGE_MESSAGES_SENT_BY_SAME_USER_WITHIN_MILLIS = 60 * 1000; // 1 minute

export default React.memo(MessagesList);

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));
    const dispatch = useDispatch();

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

    const messagesDiv = document.getElementById("messages");
    useEffect(() => {
        if (!messagesDiv || !chatFunctions.isConfirmedChat(chat)) {
            return;
        }

        const onScroll = (e: Event) => onMessagesScroll(chat, e.target as HTMLElement, dispatch);
        messagesDiv.addEventListener("scroll", onScroll);

        return () => messagesDiv.removeEventListener("scroll", onScroll);
    }, [chat, messagesDiv])

    useLayoutEffect(() => {
        if (!messagesDiv) {
            return;
        }
        if (chat.scrollTop !== null) {
            messagesDiv.scrollTop = chat.scrollTop;
        } else if (chat.scrollBottom !== null) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight - messagesDiv.clientHeight - chat.scrollBottom;
        }
    }, [chat, messagesDiv]);

    return (
        <div id="messages" className={className}>
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
        dispatch(loadMoreMessages(chat.chatId, fromId, count));
    }

    function loadMoreMessages(chatId: ChatId, fromId: number, count: number) {
        return async (dispatch: Dispatch<any>, getState: () => RootState) => {
            // Check that the chat we were tracking is still the current one, it may have changed since the "scroll"
            // event is triggered asynchronously
            const selectedChat = stateFunctions.getSelectedChat(getState().chatsState);
            if (selectedChat && chatFunctions.isConfirmedChat(selectedChat) && selectedChat.chatId === chatId) {
                dispatch(getMessages(chatId, fromId, count))
            }
        }
    }
}
