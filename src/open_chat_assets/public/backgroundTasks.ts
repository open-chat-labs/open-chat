import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { UserId } from "./model/users";
import { RootState } from "./reducers";
import { GetUserRequest } from "./services/userMgmt/getUsers";

import getAllChats from "./actions/chats/getAllChats";
import getMessagesById from "./actions/chats/getMessagesById";
import getCurrentUser from "./actions/users/getCurrentUser";
import getUsers from "./actions/users/getUsers";
import registerUser from "./actions/users/registerUser";

const PAGE_SIZE = 20;

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

    // Whenever a chat is detected with missing messages, call off to get those messages
    useEffect(() => {
        chatsState.chats.forEach(c => {
            if (c.chatId && c.missingMessages.size) {
                // Skip missing messages that have already been requested
                const missingMessages = [...c.missingMessages].filter(id => !c.missingMessagesRequested.has(id));
                if (missingMessages.length) {
                    dispatch(getMessagesById(c.chatId, missingMessages.slice(0, PAGE_SIZE)));
                }
            }
        })
    }, [chatsState.chats]);
};
