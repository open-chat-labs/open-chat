import React from "react";
import { Option } from "../model/common";
import { useDispatch } from "react-redux";
import { addParticipantsByUsername } from "../actions/chats/addParticipants";
import createGroupChat from "../actions/chats/createGroupChat";
import setupNewDirectChat from "../actions/chats/setupNewDirectChat";
import DropdownMenuIcon from "../assets/icons/dropdownMenuIcon.svg";
import { Chat, GroupChat, isGroupChat } from "../model/chats";

type Props = {
    text: string,
    selectedChat: Option<Chat>,
    clearInput: () => void
}

export default SideHeaderMenu;

function SideHeaderMenu(props: Props) {

    const dispatch = useDispatch();

    let buttons: JSX.Element[] = [];

    function dispatchAndClearInput(result: any) {
        dispatch(result);
        props.clearInput();
    }

    buttons.push(<a href="#" onClick={_ => dispatchAndClearInput(createGroupChat(props.text, []))}>New group</a>);
    buttons.push(<a href="#" onClick={_ => dispatchAndClearInput(setupNewDirectChat(props.text))}>New chat</a>);

    if (props.selectedChat && isGroupChat(props.selectedChat)) {
        const groupChat = props.selectedChat;
        buttons.push(<a href="#" onClick={_ => dispatchAndClearInput(addParticipantsByUsername(groupChat, [props.text]))}>Add participant</a>);
    }

    buttons.push(<a href="#">Profile</a>);
    buttons.push(<a href="#">Settings</a>);
    buttons.push(<a href="#">Logout</a>);

    return (
        <div className="ddl">
            <button onClick={_ => toggleDropdownMenu("chatsMenu")} className="ddl-button">
                <DropdownMenuIcon className="ddl-button-svg" />
            </button>
            <div id="chatsMenu" className="ddl-content">
                {buttons}
            </div>
        </div>
    );
}

function toggleDropdownMenu(id: string) {
    document.getElementById(id)!.classList.toggle("show");
}
