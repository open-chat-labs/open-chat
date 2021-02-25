import React from "react";
import DropdownMenuIcon from "../assets/icons/dropdownMenuIcon.svg";
import DownArrow from "../assets/icons/downArrow.svg";

type Props = {
    menuId: string,
    buttons: MenuButton[],
    useDownArrow: boolean
}

DropDownMenu.defaultProps = {
    useDownArrow: false
};

export type MenuButton = {
    text: string,
    action: (menuId: string) => void
}

export default React.memo(DropDownMenu);

function DropDownMenu(props: Props) {

    const menuContentId = props.menuId + "_ddl";

    function onClickToggler(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation();
        toggleMenu();
    }

    function onClickMenuItem(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, action: (menuId: string) => void) {
        e.stopPropagation();
        toggleMenu();
        action(props.menuId);
    }

    function toggleMenu() {
        document.getElementById(menuContentId)!.classList.toggle("hide");
    }

    return ( 
        <div className="ddl">
            <button onClick={e => onClickToggler(e)} className={"ddl-button hide-on-click-ignore" + (props.useDownArrow ? " down-arrow" : "")}>
                {props.useDownArrow ? <DownArrow className="ddl-button-svg" /> : <DropdownMenuIcon className="ddl-button-svg" />}
            </button>
            <div id={menuContentId} className="ddl-content hide-on-click-outside hide">
                {props.buttons.map(button => <a href="#" onClick={e => onClickMenuItem(e, button.action)}>{button.text}</a>)}
            </div>
        </div>
    );
}