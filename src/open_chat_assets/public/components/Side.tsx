import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";

import ChatSelection from "./ChatSelection";
import SideHeader from "./SideHeader";

export default function() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);

    const chats = chatsState.chats.map((c, index) => {
        let name: string;
        if (c.kind === "direct") {
            name = "Direct: " + (userDictionary.hasOwnProperty(c.them) ? userDictionary[c.them].username : "");
        } else {
            name = "Group: " + c.subject;
        }

        return (
            <ChatSelection key={"chatSelection-" + index} name={name} index={index} />
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
