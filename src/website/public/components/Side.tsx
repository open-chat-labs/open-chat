import React from "react";
import ChatList from "./ChatList";
import SideHeader from "./SideHeader";

export default Side;

function Side() {
    return (
        <div id="side" style={{display: "flex", flexDirection: "column", height: "100%"}}>
            <SideHeader />
            <ChatList />
        </div>
    );
}
