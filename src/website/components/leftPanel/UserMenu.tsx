import React from "react";
import { useDispatch } from "react-redux";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import PopOverMenu, { MenuItem } from "../PopOverMenu";

export default React.memo(UserMenu);

function UserMenu() {
    const dispatch = useDispatch();

    const menuItems: MenuItem[] = [];
    menuItems.push({ title: "New chat", action: () => dispatch(changeLeftPanel(LeftPanelType.NewDirectChat)) });
    menuItems.push({ title: "New group", action: () => dispatch(changeLeftPanel(LeftPanelType.NewGroupChat)) });
    menuItems.push({ title: "Profile", action: () => {} });
    menuItems.push({ title: "Settings", action: () => {} });
    menuItems.push({ title: "Logout", action: () => {} });

    return <PopOverMenu placement="bottom-start" menuItems={menuItems} />;
}

