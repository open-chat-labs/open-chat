import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";

import MessagesList from "./MessagesList";
import MainHeader from "./MainHeader";
import MainFooter from "./MainFooter";

export default Main;

function Main() {
    const selectedChatIndex = useSelector((state: RootState) => state.chatsState.selectedChatIndex);

    if (selectedChatIndex === null) {
        return <div></div>;
    }

    return (
        <main>
            <MainHeader />
            <MessagesList />
            <MainFooter />
        </main>
    );
}
