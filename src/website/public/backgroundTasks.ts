import { Dispatch, useEffect } from "react";
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
import * as chatFunctions from "./model/chats";

import { APP_TITLE, PAGE_SIZE, REFRESH_CHATS_INTERVAL_MILLISECONDS } from "./constants";
import { Option, Timestamp } from "./model/common";

export function setupBackgroundTasks() {
    const dispatch = useDispatch();

    const chatsState = useSelector((state: RootState) => state.chatsState);
    const usersState = useSelector((state: RootState) => state.usersState);

    useEffect(() => {
        let count = 0;
        for (const chat of chatsState.chats) {
            if (chatFunctions.getUnreadCount(chat)) {
                count++;
            }
        }
        document.title = (count > 0 ? `(${count}) ` : "") + APP_TITLE;;
    }, [chatsState.chats]);

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
}

function updateChatsRegularlyTask(chatsSyncedUpTo: Option<Timestamp>, dispatch: Dispatch<any>) : () => void {
    let timeoutId: NodeJS.Timeout;
    let stopped = false;
    const getUpdates: () => Promise<void> = () => dispatch(getUpdatedChats(chatsSyncedUpTo)) as any;
    const waitThenGetUpdatesLoop = () => {
        if (stopped) return;
        timeoutId = setTimeout(_ => getUpdates().finally(waitThenGetUpdatesLoop), REFRESH_CHATS_INTERVAL_MILLISECONDS);
    }

    waitThenGetUpdatesLoop();
    return () => {
        stopped = true;
        clearTimeout(timeoutId);
    }
}
