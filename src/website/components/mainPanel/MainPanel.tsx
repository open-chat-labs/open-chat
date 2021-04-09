import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../reducers";
import MessagesList from "./MessagesList";
import Header from "./Header";
import Footer from "./Footer";

export default React.memo(MainPanel);

function MainPanel() {
    const showMainWindow = useSelector((state: RootState) => state.chatsState.selectedChatIndex !== null);

    if (!showMainWindow) {
        return <div></div>;
    }

    return (
        <>
            <Header />
            <MessagesList />
            <Footer />
        </>
    );
}
