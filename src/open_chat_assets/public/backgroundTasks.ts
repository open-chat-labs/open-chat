import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { UserId } from "./model/users";
import { RootState } from "./reducers";
import { GetUserRequest } from "./services/userMgmt/getUsers";

import getAllChats from "./actions/chats/getAllChats";
import getCurrentUser from "./actions/users/getCurrentUser";
import getUsers from "./actions/users/getUsers";
import registerUser from "./actions/users/registerUser";

export function setupBackgroundTasks() {
    const dispatch = useDispatch();

    const userState = useSelector((state: RootState) => state.usersState);

    // If 'userState.mustRegisterAsNewUser' is false, attempt to get details of the current user if not already known
    useEffect(() => {
        if (!userState.mustRegisterAsNewUser && !userState.me) {
            dispatch(getCurrentUser());
        }
    }, [userState.mustRegisterAsNewUser]);

    // If 'userState.mustRegisterAsNewUser' is true then prompt the user to register
    useEffect(() => {
        if (userState.mustRegisterAsNewUser) {
            const username = window.prompt("Enter username:");

            if (username) {
                dispatch(registerUser(username));
            }
        }
    });

    // Each time 'userState.me' changes and is not null, get the full list of chats
    useEffect(() => {
        if (userState.me) {
            dispatch(getAllChats());
        }
    }, [userState.me]);

    // As new userIds are seen, fetch their usernames
    useEffect(() => {
        if (userState.unknownUserIds.length) {
            const users: GetUserRequest[] = userState
                .unknownUserIds
                .map((u: UserId) => ({ userId: u, cachedVersion: null }));

            dispatch(getUsers(users));
        }
    }, [userState.unknownUserIds]);
};
