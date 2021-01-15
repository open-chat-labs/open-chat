import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import SideHeaderMenu from "./SideHeaderMenu";
import MyAvatar from "./MyAvatar";
import SearchIcon from "../assets/icons/search.svg";
import { GroupChat } from "../model/chats";

export default SideHeader;

const PLACEHOLDER_TEXT = "Search or start a new chat";

function SideHeader() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const selectedChat = chatsState.selectedChatIndex !== null ? chatsState.chats[chatsState.selectedChatIndex] : null;
    
    const [text, setText] = useState("");
    const [placeholderText, setPlaceholderText] = useState(PLACEHOLDER_TEXT);

    return (
        <>
            <header>
                <MyAvatar />    
                <div>
                    <SideHeaderMenu text={text} selectedChat={selectedChat} clearInput={() => setText("")} />
                </div>
            </header>
            <div className="search">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={placeholderText}
                    onFocus={_ => setPlaceholderText("")}
                    onBlur={_ => setPlaceholderText(PLACEHOLDER_TEXT)} />
                <SearchIcon />
            </div>
        </>
    );
}
