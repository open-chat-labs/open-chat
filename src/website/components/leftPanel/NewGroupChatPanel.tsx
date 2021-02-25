import React from "react";
import { useDispatch } from "react-redux";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import createGroupChat from "../../actions/chats/createGroupChat";
import NameInput from "../NameInput";
import Header from "./Header";
import CancelButton from "../CancelButton";
import CreateGroupChatIcon from "../CreateGroupChatIcon";

const PLACEHOLDER_TEXT = "Group Name";

export default React.memo(NewGroupChatPanel);

function NewGroupChatPanel() {
    const dispatch = useDispatch();

    function closePanel() {
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSubmit(text: string) {
        closePanel();
        dispatch(createGroupChat(text, []));
    }

    const newChatIcon = <CreateGroupChatIcon color="#9b9b9b" backgroundColour="#e0e0e0" />;

    return (
        <>
            <Header leftIcon={newChatIcon} title="Create a new group" rightIcon={<CancelButton onClick={closePanel} />} />
            <NameInput onSubmit={handleSubmit} defaultPlaceholderText={PLACEHOLDER_TEXT} maxLength={25} />
        </>
    );
}
