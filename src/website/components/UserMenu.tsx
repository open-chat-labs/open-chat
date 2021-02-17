import React from "react";
import { useDispatch } from "react-redux";
import { changeLeftPanel, LeftPanelType } from "../actions/changeSidePanel";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(UserMenu);

function UserMenu() {
    const dispatch = useDispatch();

    const buttons: MenuButton[] = [];
    buttons.push({text: "New chat", action: () => dispatch(changeLeftPanel(LeftPanelType.NewDirectChat))});
    buttons.push({text: "New group", action: () => dispatch(changeLeftPanel(LeftPanelType.NewGroupChat))});
    buttons.push({text: "Profile", action: () => null});
    buttons.push({text: "Settings", action: () => null});
    buttons.push({text: "Logout", action: () => null});

    return (
        <DropDownMenu menuId="userMenu" buttons={buttons} />
    );
}

