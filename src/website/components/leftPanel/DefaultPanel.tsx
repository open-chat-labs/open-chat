import React, { useState } from "react";
import { useSelector } from "react-redux";
import useTheme from "@material-ui/core/styles/useTheme";
import ChatList from "../ChatList";
import Header from "./Header";
import SearchResults from "../SearchResults";
import SearchBox from "../SearchBox";
import MyAvatar from "../MyAvatar";
import { RootState } from "../../reducers";
import UserMenu from "./UserMenu";

const PLACEHOLDER_TEXT = "Search chats, users and messages";

export default React.memo(DefaultPanel);

function DefaultPanel() {
    const [inputText, setInputText] = useState("");
    const myUsername = useSelector((state: RootState) => state.usersState.me?.username)!;
    const theme = useTheme();

    const contentPanel = inputText.length
        ? <SearchResults searchTerm={inputText} clearSearchTerm={() => setInputText("")} />
        : <ChatList />;

    const avatar = <MyAvatar size="sm" parentBackgroundColor={theme.colors.header.backgroundColor} />;

    return (
        <>
            <Header leftIcon={avatar} title={myUsername} rightIcon={<UserMenu />} />
            <SearchBox text={inputText} onChange={setInputText} placeholderText={PLACEHOLDER_TEXT} />
            {contentPanel}
        </>
    );
}
