import React, { Dispatch, useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import * as chatFunctions from "../model/chats";
import { ChatId, ConfirmedChat } from "../model/chats";
import { Option } from "../model/common";
import { LocalMessage, UnconfirmedMessage } from "../model/messages";
import { MIN_MESSAGE_ID, PAGE_SIZE } from "../constants";
import getMessages from "../actions/chats/getMessages";
import { areOnSameDay } from "../utils/dateFunctions";
import { getSelectedChat } from "../utils/stateFunctions";
import MessagesFromSingleDay from "./MessagesFromSingleDay";
import UnreadMessagesHandler from "../services/UnreadMessagesHandler";

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

    let messagesFromSameDay: (LocalMessage | UnconfirmedMessage)[] = [];
    let lastMessageDate: Option<Date> = null;
    for (const message of messages) {
        if (lastMessageDate && !areOnSameDay(lastMessageDate, message.date)) {
            addDay(lastMessageDate, messagesFromSameDay);
            messagesFromSameDay = [];
        }
        messagesFromSameDay.push(message);
        lastMessageDate = message.date;
    }

    if (messagesFromSameDay.length) {
        addDay(lastMessageDate!, messagesFromSameDay);
    }

    function addDay(date: Date, messages: (LocalMessage | UnconfirmedMessage)[]) {
        children.push(<MessagesFromSingleDay
            key = {date.toDateString()}
            isGroupChat={isGroupChat}
            myUserId={myUserId}
            usersDictionary={usersDictionary}
            messages={messagesFromSameDay}
            unreadMessageIds={unreadMessageIds} />);
    }

    let className = "detail";
    if (isGroupChat) {
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

    let chatId: Option<ChatId> = null;
    let hasUnreadMessages: boolean = false;
    if (chatFunctions.isConfirmedChat(chat)) {
        chatId = chat.chatId;
        hasUnreadMessages = chat.unreadMessageIds.length > chat.markAsReadPending.length;
    }

    // Start a new UnreadMessagesHandler to mark messages as read once they have been visible for a certain duration
    useLayoutEffect(() => {
        if (!chatId || !hasUnreadMessages) {
            return;
        }

        const unreadMessagesHandler = new UnreadMessagesHandler(chatId);
        unreadMessagesHandler.start();
        return () => unreadMessagesHandler.stop();
    }, [chatId, hasUnreadMessages]);

    return (
        <div id="messages" ref={messagesRef} className={className}>
            {children}
        </div>
    );
}

// Listen to scroll events and load more messages if the user scrolls near the top of the currently loaded messages
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
}
