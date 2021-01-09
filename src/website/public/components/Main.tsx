import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import sendMessage from "../actions/chats/sendMessage";

import SendButton from "../send_button.svg";
import MessagesList from "./MessagesList";

export default Main;

function Main() {
    const dispatch = useDispatch();
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const [newMessageText, setNewMessageText] = useState("");

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    return (
        <div id="main" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
            <MessagesList />
            <input value={newMessageText} onChange={e => setNewMessageText(e.target.value)}/>
            <button onClick={handleSendMessage}><SendButton /></button>
        </div>
    );

    function handleSendMessage() {
        if (newMessageText) {
            dispatch(sendMessage(chat, newMessageText))
        }
        setNewMessageText("");
    }
}
