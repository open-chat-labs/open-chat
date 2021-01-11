import React, { useState } from "react";
import { useDispatch } from "react-redux";

import setupNewDirectChat from "../actions/chats/setupNewDirectChat";

import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import DefaultAvatar from "../assets/icons/defaultAvatar.svg";
import SearchIcon from "../assets/icons/search.svg";

export default SideHeader;

const PLACEHOLDER_TEXT = "Search or start a new chat";

function SideHeader() {
    const [text, setText] = useState("");
    const [placeholderText, setPlaceholderText] = useState(PLACEHOLDER_TEXT);
    const dispatch = useDispatch();

    return (
        <>
            <header>
                <button className="avatar-button">
                    <DefaultAvatar className="avatar" />
                </button>
                <div>
                    <button className="add-chat" onClick={_ => dispatch(setupNewDirectChat(text))}>Add chat</button>
                    <button className="add-group">
                        <CreateGroupChatIcon />
                    </button>
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
