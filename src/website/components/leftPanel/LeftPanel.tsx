import React from "react";
import { LeftPanelType } from "../../actions/changeSidePanel";
import DefaultSidePanel from "./DefaultPanel";
import JoinGroupChatSidePanel from "./JoinGroupChatPanel";
import NewDirectChatSidePanel from "./NewDirectChatPanel";
import NewGroupChatSidePanel from "./NewGroupChatPanel";

export default LeftPanel;

type Props = {
    type: LeftPanelType
}

function LeftPanel(props: Props) {
    switch (props.type) {
        case LeftPanelType.Chats:
            return <DefaultSidePanel />;
        case LeftPanelType.JoinGroupChat:
            return <JoinGroupChatSidePanel />;
        case LeftPanelType.NewDirectChat:
            return <NewDirectChatSidePanel />;
        case LeftPanelType.NewGroupChat:
            return <NewGroupChatSidePanel />;
    }
}
