import React from "react";
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import createGroupChat from "../../actions/chats/createGroupChat";
import NameInput from "../NameInput";
import Header from "./Header";
import CancelButton from "../CancelButton";
import CreateGroupChatIcon from "../CreateGroupChatIcon";

const PLACEHOLDER_TEXT = "Group Name";

export default React.memo(NewGroupChatPanel);

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        marginTop: 60
    }
}));

function NewGroupChatPanel() {
    const dispatch = useDispatch();
    const classes = useStyles();

    function closePanel() {
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSubmit(text: string) {
        closePanel();
        dispatch(createGroupChat(text, []));
    }

    const newChatIcon = <CreateGroupChatIcon size="sm" />;

    return (
        <>
            <Header leftIcon={newChatIcon} title="Create a new group" rightIcon={<CancelButton onClick={closePanel} />} />
            <NameInput onSubmit={handleSubmit} defaultPlaceholderText={PLACEHOLDER_TEXT} maxLength={25} className={classes.nameInput} />
        </>
    );
}
