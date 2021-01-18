import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import sendMessage from "../actions/chats/sendMessage";
import Paperclip from "../assets/icons/paperclip.svg";
import SendButton from "../assets/icons/sendButton.svg";

export default MainFooter;

function MainFooter() {
    const dispatch = useDispatch();
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const [newMessageText, setNewMessageText] = useState("");

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    return (
        <footer className="enter-message">
            <label className="attach">
                <Paperclip />
                <input className="hide" type="file" accept="image/*,video/mp4,video/webm,video/ogg" />
            </label>
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
            dispatch(sendMessage(chat, { kind: "text", text: newMessageText }));
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
