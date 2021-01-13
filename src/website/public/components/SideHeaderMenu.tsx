import React from "react";
import { useDispatch } from "react-redux";
import setupNewDirectChat from "../actions/chats/setupNewDirectChat";
import DropdownMenuIcon from "../assets/icons/dropdownMenuIcon.svg";

type Props = {
    text: string,
}

export default SideHeaderMenu;

function SideHeaderMenu(props: Props) {

    const dispatch = useDispatch();

    return (
        <div className="ddl">
            <button onClick={_ => toggleDropdownMenu("chatsMenu")} className="ddl-button">
                <DropdownMenuIcon className="ddl-button-svg" />
            </button>
            <div id="chatsMenu" className="ddl-content">
                <a href="#">New group</a>
                <a href="#" onClick={a => dispatch(setupNewDirectChat(props.text))}>New chat</a>
                <a href="#">Profile</a>
                <a href="#">Settings</a>
                <a href="#">Logout</a>
            </div>
        </div>
    );
}

function toggleDropdownMenu(id: string) {
    document.getElementById(id)!.classList.toggle("show");
}
