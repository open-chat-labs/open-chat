import React from "react";
import { useDispatch } from "react-redux";
import { changeRightPanel, RightPanelType } from "../actions/changeSidePanel";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(GroupChatMenu);

function GroupChatMenu() {
    const dispatch = useDispatch();

    const buttons: MenuButton[] = [];
    buttons.push({text: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Particpants))});
    buttons.push({text: "Mute notifications", action: () => null});
    buttons.push({text: "Leave group", action: () => null});

    return (
        <DropDownMenu menuId="chatMenu" buttons={buttons} />
    );
}

