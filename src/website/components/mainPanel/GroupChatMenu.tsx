import React from "react";
import { useDispatch } from "react-redux";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import PopOverMenu, { MenuItem } from "../PopOverMenu";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";

export default React.memo(DirectChatMenu);

function DirectChatMenu() {
    const dispatch = useDispatch();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Particpants)) });
    menuItems.push({ text: "Mute notifications", action: () => {} });
    menuItems.push({ text: "Leave group", action: () => {} });

    return <PopOverMenu icon={<MoreVertIcon />} menuItems={menuItems} placement="bottom-end" />;
}
