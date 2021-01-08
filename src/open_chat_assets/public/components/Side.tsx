import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";

import ChatSelection from "./ChatSelection";
import SideHeader from "./SideHeader";

export default Side;

function Side() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    const chats = chatsState.chats.map((c, index) => {
        let name: string;
        let key: string;
        if (c.kind === "group") {
            name = "Group: " + c.subject;
            key = "G-" + c.chatId.toString();
        } else {
            name = "Direct: " + (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
            key = "D-" + c.them.toString();
        }

        return (
            <ChatSelection key={key} name={name} index={index} />
        );
    });

    return (
        <div id="side" style={{display: "flex", flexDirection: "column", height: "100%"}}>
            <SideHeader />
            <ul>
                {chats}
            </ul>
        </div>
    );
}
