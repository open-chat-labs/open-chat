import React, { useState } from "react";
import ChatList from "../ChatList";
import Header from "./Header";
import SearchResults from "../SearchResults";
import SearchBox from "../SearchBox";
import MyAvatar from "../MyAvatar";
import { useSelector } from "react-redux";
import { RootState } from "../../reducers";
import UserMenu from "./UserMenu";

const PLACEHOLDER_TEXT = "Search chats, users and messages";
const SEARCH_BOX_ID = "mainSearchBox";

export default React.memo(DefaultPanel);

function DefaultPanel() {
    const [inputText, setInputText] = useState("");
    const myUsername = useSelector((state: RootState) => state.usersState.me?.username)!;

    const contentPanel = inputText.length
        ? <SearchResults searchTerm={inputText} clearSearchTerm={() => setInputText("")} />
        : <ChatList />;

    return (
        <>
            <Header leftIcon={<MyAvatar size="sm" />} title={myUsername} rightIcon={<UserMenu />} />
            <SearchBox id={SEARCH_BOX_ID} text={inputText} onChange={setInputText} defaultPlaceholderText={PLACEHOLDER_TEXT} />
            {contentPanel}
        </>
    );
}
