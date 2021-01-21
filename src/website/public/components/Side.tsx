import React from "react";
import ChatList from "./ChatList";
import SideHeader from "./SideHeader";

export default React.memo(Side);

function Side() {
    return (
        <section className="sidebar">
            <SideHeader />
            <ChatList />
        </section>
    );
}
