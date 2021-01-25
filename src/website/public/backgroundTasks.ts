import { Dispatch, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { ChatId, ConfirmedChat } from "./model/chats";
import { UserId } from "./model/users";
import { RootState } from "./reducers";
import { GetUserRequest } from "./services/userMgmt/getUsers";

import getAllChats from "./actions/chats/getAllChats";
import getMessagesById from "./actions/chats/getMessagesById";
import getMessages from "./actions/chats/getMessages";
import getUpdatedChats from "./actions/chats/getUpdatedChats";

import getCurrentUser from "./actions/users/getCurrentUser";
import getUsers from "./actions/users/getUsers";
import registerUser from "./actions/users/registerUser";

import * as chatFunctions from "./model/chats";
import * as stateFunctions from "./utils/stateFunctions";

import { MIN_MESSAGE_ID, PAGE_SIZE, REFRESH_CHATS_INTERVAL_MILLISECONDS } from "./constants";
import { Option, Timestamp } from "./model/common";

export function setupBackgroundTasks() {
    const dispatch = useDispatch();

    const chatsState = useSelector((state: RootState) => state.chatsState);
    const usersState = useSelector((state: RootState) => state.usersState);
    const selectedChat = stateFunctions.getSelectedChat(chatsState);

    // If 'usersState.mustRegisterAsNewUser' is false, attempt to get details of the current user if not already known
    useEffect(() => {
        if (!usersState.mustRegisterAsNewUser && !usersState.me) {
            dispatch(getCurrentUser());
        }
    }, [usersState.mustRegisterAsNewUser]);

    // If 'usersState.mustRegisterAsNewUser' is true then prompt the user to register
    useEffect(() => {
        if (usersState.mustRegisterAsNewUser) {
            const username = window.prompt("Enter username:");

            if (username) {
                dispatch(registerUser(username));
            }
        }
    });

    // Each time 'usersState.me' changes and is not null, get the full list of chats
    useEffect(() => {
        if (usersState.me) {
            dispatch(getAllChats());
        }
    }, [usersState.me]);

    // As new userIds are seen, fetch their usernames
    useEffect(() => {
        if (usersState.unknownUserIds.length) {
            const users: GetUserRequest[] = usersState
                .unknownUserIds
                .map((u: UserId) => ({ userId: u, cachedVersion: null }));

            dispatch(getUsers(users));
        }
    }, [usersState.unknownUserIds]);

    // Whenever a chat has messages to download, call off to get those messages
    useEffect(() => {
        chatsState.chats.forEach(c => {
            if ("chatId" in c && c.messagesToDownload.length && !c.messagesDownloading.length) {
                dispatch(getMessagesById(c.chatId, c.messagesToDownload.slice(0, PAGE_SIZE)));
            }
        })
    }, [chatsState.chats]);

    // Check for new messages at regular intervals
    useEffect(() => {
        if (chatsState.runUpdateChatsTask) {
            return updateChatsRegularlyTask(chatsState.chatsSyncedUpTo, dispatch);
        }
    }, [chatsState.runUpdateChatsTask, chatsState.chatsSyncedUpTo]);

    useEffect(() => {
        if (!selectedChat || !chatFunctions.isConfirmedChat(selectedChat)) {
            return;
        }
        const messagesDiv = document.getElementById("messages")!;
        if (!messagesDiv) {
            return;
        }

        const onScroll = (e: Event) => onMessagesScroll(selectedChat, e.target as HTMLElement, dispatch);
        messagesDiv.addEventListener("scroll", onScroll);

        return () => messagesDiv.removeEventListener("scroll", onScroll);
    }, [selectedChat])
}

function updateChatsRegularlyTask(chatsSyncedUpTo: Option<Timestamp>, dispatch: Dispatch<any>) : () => void {
    let timeoutId: NodeJS.Timeout;
    const getUpdates: () => Promise<void> = () => dispatch(getUpdatedChats(chatsSyncedUpTo)) as any;
    const waitThenGetUpdatesLoop = () => {
        timeoutId = setTimeout(_ => getUpdates().finally(waitThenGetUpdatesLoop), REFRESH_CHATS_INTERVAL_MILLISECONDS);
    }

    waitThenGetUpdatesLoop();
    return () => clearTimeout(timeoutId);
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
