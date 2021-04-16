import React, { useState } from "react";
import { useSelector } from "react-redux";
import ChatList from "./ChatList";
import Header from "./Header";
import SearchResults from "./SearchResults";
import SearchBox from "../shared/SearchBox";
import MyAvatar from "./MyAvatar";
import { RootState } from "../../reducers";
import UserMenu from "./UserMenu";
import authClient from "../../utils/authClient";

const PLACEHOLDER_TEXT = "Search chats, users and messages";

export default React.memo(DefaultPanel);

function DefaultPanel() {
    const [inputText, setInputText] = useState("");
    const myUsername = useSelector((state: RootState) => state.usersState.me?.username)!;

    const p = authClient.getIdentity().getPrincipal().toText();
    const principal = p.substring(0, 3) + "..." + p.substring(p.length - 3, p.length);

    const usernameAndPrincipal = myUsername + " (" + principal + ")";

    const contentPanel = inputText.length
        ? <SearchResults searchTerm={inputText} clearSearchTerm={() => setInputText("")} />
        : <ChatList />;

    const avatar = <MyAvatar size="sm" />;

    return (
        <>
            <Header leftIcon={avatar} title={usernameAndPrincipal} rightIcon={<UserMenu />} />
            <SearchBox text={inputText} onChange={setInputText} placeholderText={PLACEHOLDER_TEXT} />
            {contentPanel}
        </>
    );
}
