import React from "react";
import PopOverMenu, { MenuItem } from "../PopOverMenu";

export default React.memo(DirectChatMenu);

function DirectChatMenu() {
    const menuItems: MenuItem[] = [];
    menuItems.push({ title: "Contact info", action: () => {} });
    menuItems.push({ title: "Mute notifications", action: () => {} });
    menuItems.push({ title: "Delete chat", action: () => {} });

    return <PopOverMenu menuItems={menuItems} placement="bottom-end" />;
}
