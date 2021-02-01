import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";

import MessagesList from "./MessagesList";
import MainHeader from "./MainHeader";
import MainFooter from "./MainFooter";

export default React.memo(Main);

function Main() {
    const showMainWindow = useSelector((state: RootState) => state.chatsState.selectedChatIndex !== null);

    if (!showMainWindow) {
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
