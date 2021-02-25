import React from "react";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import PopOverMenu, { MenuItem } from "../PopOverMenu";

export default React.memo(DirectChatMenu);

function DirectChatMenu() {
    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Contact info", action: () => {} });
    menuItems.push({ text: "Mute notifications", action: () => {} });
    menuItems.push({ text: "Delete chat", action: () => {} });

    return <PopOverMenu icon={<MoreVertIcon />} menuItems={menuItems} placement="bottom-end" />;
}
