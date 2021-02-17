import React from "react";
import { useDispatch } from "react-redux";
import { changeRightPanel, RightPanelType } from "../actions/changeSidePanel";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(GroupChatMenu);

function GroupChatMenu() {
    const dispatch = useDispatch();

    const buttons: MenuButton[] = [];
    buttons.push({text: "Group info", action: () => null});
    buttons.push({text: "Add participants", action: () => dispatch(changeRightPanel(RightPanelType.AddParticpants))});
    buttons.push({text: "Remove participants", action: () => null});
    buttons.push({text: "Mute notifications", action: () => null});
    buttons.push({text: "Exit group", action: () => null});

    return (
        <DropDownMenu menuId="chatMenu" buttons={buttons} />
    );
}

