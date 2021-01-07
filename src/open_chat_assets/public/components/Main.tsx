import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../reducers";
import sendMessage from "../actions/chats/sendMessage";

export default function() {
    const dispatch = useDispatch();
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const [newMessageText, setNewMessageText] = useState("");

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    const confirmedMessages = chat.kind !== "newDirect"
        ? chat.confirmedMessages.map(m => {
            switch (m.kind) {
                case "local":
                    return <div>{m.text}</div>;

                case "remote":
                    return <div style={{fontStyle: "italic"}}>loading...</div>
            }
        })
        : null;

    const unconfirmedMessages = chat.unconfirmedMessages.map(m => <div style={{fontStyle: "italic"}}>{m.text}</div>);

    return (
        <div id="main" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
            <div>
                {confirmedMessages}
                {unconfirmedMessages}
            </div>
            <input value={newMessageText} onChange={e => setNewMessageText(e.target.value)}/>
            <button onClick={handleSendMessage}>+</button>
        </div>
    );

    function handleSendMessage() {
        if (newMessageText) {
            dispatch(sendMessage(chat, newMessageText))
        }
        setNewMessageText("");
    }
}
