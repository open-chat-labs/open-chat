import React from "react";
import DropdownMenuIcon from "../assets/icons/dropdownMenuIcon.svg";

type Props = {
    menuId: string,
    buttons: MenuButton[]
}

export type MenuButton = {
    text: string,
    action: () => void
}

export default React.memo(DropDownMenu);

function DropDownMenu(props: Props) {

    function toggleChatsMenu() {
        document.getElementById(props.menuId)!.classList.toggle("hide");
    }

    function closeMenu(action: () => void) {
        toggleChatsMenu();
        action();
    }

    return ( 
        <div className="ddl">
            <button onClick={_ => toggleChatsMenu()} className="ddl-button hide-on-click-ignore">
                <DropdownMenuIcon className="ddl-button-svg" />
            </button>
            <div id={props.menuId} className="ddl-content hide-on-click-outside hide">
                {props.buttons.map(button => <a href="#" onClick={_ => closeMenu(button.action)}>{button.text}</a>)}
            </div>
        </div>
    );
}