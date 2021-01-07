import React, { useState } from "react";
import { useDispatch } from "react-redux";

import setupNewDirectChat from "../actions/chats/setupNewDirectChat";

export default SideHeader;

function SideHeader() {
    const [newChatUsername, setNewChatUsername] = useState("");
    const dispatch = useDispatch();

    return (
        <div>
            <input value={newChatUsername} onChange={(e) => setNewChatUsername(e.target.value)}/>
            <button onClick={_ => dispatch(setupNewDirectChat(newChatUsername))}>+</button>
        </div>
    );
}
