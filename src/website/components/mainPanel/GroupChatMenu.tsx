import React from "react";
import { useDispatch } from "react-redux";
import PopOverMenu, { MenuItem } from "../PopOverMenu";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";

export default React.memo(DirectChatMenu);

function DirectChatMenu() {
    const dispatch = useDispatch();

    const menuItems: MenuItem[] = [];
    menuItems.push({ title: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Particpants)) });
    menuItems.push({ title: "Mute notifications", action: () => {} });
    menuItems.push({ title: "Leave group", action: () => {} });

    return <PopOverMenu menuItems={menuItems} placement="bottom-end" />;
}
