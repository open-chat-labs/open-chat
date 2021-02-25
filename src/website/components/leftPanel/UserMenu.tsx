import React from "react";
import { useDispatch } from "react-redux";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import PopOverMenu, { MenuItem } from "../PopOverMenu";

export default React.memo(UserMenu);

function UserMenu() {
    const dispatch = useDispatch();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "New chat", action: () => dispatch(changeLeftPanel(LeftPanelType.NewDirectChat)) });
    menuItems.push({ text: "New group", action: () => dispatch(changeLeftPanel(LeftPanelType.NewGroupChat)) });
    menuItems.push({ text: "Profile", action: () => {} });
    menuItems.push({ text: "Settings", action: () => {} });
    menuItems.push({ text: "Logout", action: () => {} });

    return <PopOverMenu icon={<MoreVertIcon />} placement="bottom-start" menuItems={menuItems} />;
}

