import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "./reducers";
import userMgmtService from "./services/userMgmt/service";
import { UserId, UserSummary } from "./model/users";
import * as chatFunctions from "./model/chats";
import * as setFunctions from "./utils/setFunctions";
import * as stateFunctions from "./utils/stateFunctions";
import RecurringTaskRunner from "./utils/RecurringTaskRunner";
import RtcConnectionHandler from "./webRtc/RtcConnectionHandler";

import getAllChats from "./actions/chats/getAllChats";
import getMessagesById from "./actions/chats/getMessagesById";
import getUpdatedChats from "./actions/chats/getUpdatedChats";
import getCurrentUser from "./actions/users/getCurrentUser";
import getUsers from "./actions/users/getUsers";
import registerUser from "./actions/users/registerUser";
import updateMinutesSinceLastOnline from "./actions/users/updateMinutesSinceLastOnline";

import {
    APP_TITLE,
    MARK_CURRENT_USER_AS_ONLINE_INTERVAL_MS,
    PAGE_SIZE,
    REFRESH_CHATS_INTERVAL_MS, REFRESH_P2P_CONNECTIONS_MS,
    UPDATE_USERS_INTERVAL_MS
} from "./constants";

export function setupBackgroundTasks() {
    const dispatch = useDispatch();

    const chatsState = useSelector((state: RootState) => state.chatsState);
    const usersState = useSelector((state: RootState) => state.usersState);
    const selectedChat = stateFunctions.getSelectedChat(chatsState);
    const selectedChatUsers = selectedChat ? chatFunctions.getUsers(selectedChat) : [];
    const usersOnline = (Object.values(usersState.userDictionary) as UserSummary[])
        .filter(u => u.minutesSinceLastOnline < 2)
        .map(u => u.userId);

    const selectedChatUsersOnline = setFunctions.intersect(selectedChatUsers, usersOnline);

    useEffect(() => {
        const count = chatFunctions.getUnreadChatCount(chatsState.chats);
        document.title = (count > 0 ? `(${count}) ` : "") + APP_TITLE;
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
            dispatch(getUsers(usersState.unknownUserIds));
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
            const getUpdates: () => Promise<void> = () => dispatch(getUpdatedChats(chatsState.chatsSyncedUpTo)) as any;
            const taskRunner = RecurringTaskRunner.startNew(getUpdates, REFRESH_CHATS_INTERVAL_MS, true);
            return () => taskRunner.stop();
        }
    }, [chatsState.runUpdateChatsTask, chatsState.chatsSyncedUpTo]);

    // Mark current user as online at regular intervals
    useEffect(() => {
        if (usersState.me?.userId) {
            const markAsOnline: () => Promise<void> = () => userMgmtService.markAsOnline();
            const taskRunner = RecurringTaskRunner.startNew(markAsOnline, MARK_CURRENT_USER_AS_ONLINE_INTERVAL_MS, false);
            return () => taskRunner.stop();
        }
    }, [usersState.me?.userId]);

    // Update user details at regular intervals
    const userIdsCount = usersState.userDictionary ? Object.keys(usersState.userDictionary).length : 0;
    useEffect(() => {
        if (usersState.userDictionary) {
            const updateUsers: () => Promise<void> = () => {
                const updateUsersTask: Promise<void> = dispatch(getUsers(Object.keys(usersState.userDictionary), usersState.usersSyncedUpTo)) as any;
                return updateUsersTask.finally(() => dispatch(updateMinutesSinceLastOnline()));
            }
            const taskRunner = RecurringTaskRunner.startNew(updateUsers, UPDATE_USERS_INTERVAL_MS, true);
            return () => taskRunner.stop();
        }
    }, [userIdsCount, usersState.usersSyncedUpTo]);

    // Each time the users in the selected chat change, attempt to make p2p connections to each user
    useEffect(() => {
        if (!selectedChat || !selectedChatUsersOnline.length) {
            return;
        }
        RtcConnectionHandler.setupMissingConnections(selectedChatUsersOnline);
    }, [JSON.stringify(selectedChatUsersOnline)]);

    // Poll for new p2p connection details at regular intervals, this could be responses to our connection offers or new
    // offers from other users trying to establish a p2p connection with us
    useEffect(() => {
        if (!usersState.me?.userId) {
            return;
        }
        const taskRunner = RecurringTaskRunner.startNew(RtcConnectionHandler.getConnections, REFRESH_P2P_CONNECTIONS_MS, false);
        return () => taskRunner.stop();
    }, [usersState.me?.userId]);
}
