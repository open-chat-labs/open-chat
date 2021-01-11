import React, { useState } from "react";
import { useDispatch } from "react-redux";

import setupNewDirectChat from "../actions/chats/setupNewDirectChat";

import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import DirectChatDefaultAvatar from "../assets/icons/directChatDefaultAvatar.svg";
import SearchIcon from "../assets/icons/search.svg";

const DEFAULT_TEXT = "Search or start a new chat";

export default SideHeader;

function SideHeader() {
    const [text, setText] = useState(DEFAULT_TEXT);
    const dispatch = useDispatch();

    return (
        <>
            <header>
                <button className="avatar-button">
                    <DirectChatDefaultAvatar className="avatar" />
                </button>
                <div>
                    <button className="add-chat" onClick={_ => dispatch(setupNewDirectChat(text))}>Add chat</button>
                    <button className="add-group">
                        <CreateGroupChatIcon />
                    </button>
                </div>
            </header>
            <div className="search">
                <input value={text} onFocus={_ => setText("")} onChange={e => setText(e.target.value)} />
                <SearchIcon />
            </div>
        </>
    );
}
