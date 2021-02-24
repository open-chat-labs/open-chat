import React from "react";
import { LeftPanelType } from "../../actions/changeSidePanel";
import DefaultSidePanel from "./DefaultPanel";
import NewDirectChatSidePanel from "./NewDirectChatPanel";
import NewGroupChatSidePanel from "./NewGroupChatPanel";

export default LeftPanel;

type Props = {
    type: LeftPanelType,
    rightPanelActive: boolean
}

function LeftPanel(props: Props) {
    switch (props.type) {
        case LeftPanelType.NewDirectChat:
            return <NewDirectChatSidePanel/>;
        case LeftPanelType.NewGroupChat:
            return <NewGroupChatSidePanel/>;
        case LeftPanelType.Chats:
            return <DefaultSidePanel />;
    }
}
