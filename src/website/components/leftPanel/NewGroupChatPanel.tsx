import React, { useState } from "react";
import { useDispatch } from "react-redux";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel } from "../../actions/app/changeSidePanel";
import createGroupChat from "../../actions/chats/createGroupChat";
import Header from "./Header";
import CancelButton from "../shared/CloseButton";
import CreateGroupChatIcon from "../shared/CreateGroupChatIcon";
import NameInput from "../shared/NameInput";
import { LeftPanelType } from "../../domain/model/panels";

const PLACEHOLDER_TEXT = "Group Name";

export default React.memo(NewGroupChatPanel);

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        marginTop: 60
    },
    textBox: {
        marginLeft: 30
    },
    checkBox: {
        margin: "20px auto 0"
    },
    cancelButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function NewGroupChatPanel() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const [chatHistoryVisibleToNewJoiners, setChatHistoryVisibleToNewJoiners] = useState(false);

    function closePanel() {
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSubmit(text: string) {
        closePanel();
        dispatch(createGroupChat(text, [], chatHistoryVisibleToNewJoiners));
    }

    const newChatIcon = <CreateGroupChatIcon size="sm" />;

    const chatHistoryVisibleCheckBox = <FormControlLabel
        control={<Checkbox color="default" />}
        label="Chat history visible to new joiners"
        className={classes.checkBox}
        checked={chatHistoryVisibleToNewJoiners}
        onChange={(_, checked) => setChatHistoryVisibleToNewJoiners(checked)} />;

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
                children={[chatHistoryVisibleCheckBox]}
                className={classes.nameInput}
                textBoxClassName={classes.textBox} />
        </>
    );
}
