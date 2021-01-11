import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import sendMessage from "../actions/chats/sendMessage";

import SendButton from "../send_button.svg";

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
            <input id="newMessage" value={newMessageText} placeholder="Type a message" onChange={e => setNewMessageText(e.target.value)}/>
            <button onClick={handleSendMessage} className="send">
                <SendButton />
            </button>
        </footer>
    );

    function handleSendMessage() {
        if (newMessageText) {
            dispatch(sendMessage(chat, newMessageText))
        }
        setNewMessageText("");
        //scrollMessagesToBottom()
    }
}
