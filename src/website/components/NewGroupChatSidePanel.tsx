import React from "react";
import { useDispatch } from "react-redux";
import { changeLeftPanel, LeftPanelType } from "../actions/changeSidePanel";
import createGroupChat from "../actions/chats/createGroupChat";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import NameInput from "./NameInput";

const PLACEHOLDER_TEXT = "Group Name";

export default React.memo(NewGroupChatSidePanel);

function NewGroupChatSidePanel() {
    const dispatch = useDispatch();

    function closePanel() {
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSubmit(text: string) {
        closePanel();
        dispatch(createGroupChat(text, []));
    }

    return (
        <>
            <header>
                <div className="new-chat-icon"><CreateGroupChatIcon /></div>
                <div className="my-display-name">Create a new group</div>
                <div className="chats-menu-container">
                    <div className="ddl-button" onClick={_ => closePanel()}>
                        <CancelIcon className="ddl-button-svg" />
                    </div>
                </div>
            </header>

            <NameInput onSubmit={handleSubmit} defaultPlaceholderText={PLACEHOLDER_TEXT} maxLength={25} />
        </>
    );
}
