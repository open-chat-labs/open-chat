import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { UserId } from "./model/users";
import { RootState } from "./reducers";
import { GetUserRequest } from "./services/userMgmt/getUsers";

import getAllChats from "./actions/chats/getAllChats";
import getMessagesById from "./actions/chats/getMessagesById";
import getUpdatedChats from "./actions/chats/getUpdatedChats";

import getCurrentUser from "./actions/users/getCurrentUser";
import getUsers from "./actions/users/getUsers";
import registerUser from "./actions/users/registerUser";

import { REFRESH_CHATS_INTERVAL_MILLISECONDS, PAGE_SIZE } from "./constants";

export function setupBackgroundTasks() {
    const dispatch = useDispatch();

    const chatsState = useSelector((state: RootState) => state.chatsState);
    const usersState = useSelector((state: RootState) => state.usersState);

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

    // If the selected chat changes (to different chat or there is a new message) 
    // then scroll the message window to the bottom
    const selectedChat = chatsState.selectedChatIndex !== null ? chatsState.chats[chatsState.selectedChatIndex] : null;
    useEffect(() => {
        var objDiv = document.getElementById("messages");
        if (objDiv) {
            objDiv.scrollTop = objDiv.scrollHeight;         
        }
    }, [selectedChat]);

    // Check for new messages at regular intervals
    useEffect(() => {
        if (!usersState.me || !chatsState.chatsSyncedUpTo) {
            return;
        }

        const getUpdates = () => dispatch(getUpdatedChats(chatsState.chatsSyncedUpTo, () => setupTimeout()));
        const setupTimeout = () => timeoutId = setTimeout(getUpdates, REFRESH_CHATS_INTERVAL_MILLISECONDS);

        let timeoutId: NodeJS.Timeout;
        setupTimeout();
        return () => clearTimeout(timeoutId);
    }, [chatsState.chatsSyncedUpTo]);
};
