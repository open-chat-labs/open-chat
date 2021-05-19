import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import createGroupChat from "../../actions/chats/createGroupChat";
import Header from "./Header";
import CancelButton from "../shared/CloseButton";
import CreateGroupChatIcon from "../shared/CreateGroupChatIcon";
import NameInput from "../shared/NameInput";

const PLACEHOLDER_TEXT = "Group Name";

export default React.memo(NewGroupChatPanel);

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        marginTop: 60,
        marginLeft: 30
    },
    cancelButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
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
            <Header
                leftIcon={newChatIcon}
                title="Create a new group"
                rightIcon={<CancelButton onClick={closePanel} className={classes.cancelButton} />} />
            <NameInput
                onSubmit={handleSubmit}
                placeholderText={PLACEHOLDER_TEXT}
                minLength={2}
                maxLength={25}
                className={classes.nameInput} />
        </>
    );
}
