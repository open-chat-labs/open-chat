import React from "react";
import { useDispatch } from "react-redux";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(DirectChatMenu);

function DirectChatMenu() {
    const dispatch = useDispatch();

    const buttons: MenuButton[] = [];
    buttons.push({text: "Contact info", action: () => null});
    buttons.push({text: "Mute notifications", action: () => null});
    buttons.push({text: "Delete chat", action: () => null});

    return (
        <DropDownMenu menuId="chatMenu" buttons={buttons} />
    );
}

