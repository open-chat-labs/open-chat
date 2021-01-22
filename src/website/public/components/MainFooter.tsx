import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import sendMessage from "../actions/chats/sendMessage";
import { getSelectedChat } from "../utils/stateFunctions";
import SendButton from "../assets/icons/sendButton.svg";
import AttachFile from "./AttachFile";

export default React.memo(MainFooter);

function MainFooter() {
    const dispatch = useDispatch();
    const chat = useSelector(getSelectedChat);
    const [newMessageText, setNewMessageText] = useState("");

    if (chat === null) {
        return <div></div>;
    }

    return (
        <footer className="enter-message">
            <AttachFile chat={chat} />
            <input
                id="newMessage"
                value={newMessageText}
                placeholder="Type a message"
                onChange={e => setNewMessageText(e.target.value)}
                onKeyDown={handleKeyPress} />
            <button onClick={handleSendMessage} className="send">
                <SendButton />
            </button>
        </footer>
    );

    function handleSendMessage() {
        if (newMessageText) {
            dispatch(sendMessage(chat!, { kind: "text", text: newMessageText }));
        }
        setNewMessageText("");
        //scrollMessagesToBottom()
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    }
}
