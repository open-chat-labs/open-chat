import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { addParticipantsByUsername } from "../actions/chats/addParticipants";
import createGroupChat from "../actions/chats/createGroupChat";
import setupNewDirectChat from "../actions/chats/setupNewDirectChat";
import DropdownMenuIcon from "../assets/icons/dropdownMenuIcon.svg";
import { isGroupChat } from "../model/chats";
import { RootState } from "../reducers";
import { getSelectedChat } from "../utils/stateFunctions";

type Props = {
    text: string,
    clearInput: () => void
}

export default React.memo(SideHeaderMenu);

function SideHeaderMenu(props: Props) {

    const dispatch = useDispatch();
    const selectedChat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    const buttons: JSX.Element[] = [];

    function dispatchAndClearInput(result: any) {
        dispatch(result);
        props.clearInput();
    }

    buttons.push(<a href="#" onClick={_ => dispatchAndClearInput(setupNewDirectChat(props.text))}>New chat</a>);
    buttons.push(<a href="#" onClick={_ => dispatchAndClearInput(createGroupChat(props.text, []))}>New group</a>);

    if (selectedChat && isGroupChat(selectedChat)) {
        const groupChat = selectedChat;
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
