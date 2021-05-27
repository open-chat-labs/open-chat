import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel } from "../../actions/app/changeSidePanel";
import Header from "./Header";
import CancelButton from "../shared/CloseButton";
import CreateGroupChatIcon from "../shared/CreateGroupChatIcon";
import NameInput from "../shared/NameInput";
import joinGroup from "../../actions/chats/joinGroup";
import { LeftPanelType } from "../../domain/model/panels";

const PLACEHOLDER_TEXT = "Invite Code";

export default React.memo(JoinGroupChatPanel);

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        marginTop: 60,
        marginLeft: 30
    },
    cancelButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function JoinGroupChatPanel() {
    const dispatch = useDispatch();
    const classes = useStyles();

    function closePanel() {
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSubmit(text: string) {
        closePanel();

        const chatId = BigInt("0x" + text);

        dispatch(joinGroup(chatId));
    }

    const newChatIcon = <CreateGroupChatIcon size="sm" />;

    return (
        <>
            <Header
                leftIcon={newChatIcon}
                title="Join a group"
                rightIcon={<CancelButton onClick={closePanel} className={classes.cancelButton} />} />
            <NameInput
                onSubmit={handleSubmit}
                placeholderText={PLACEHOLDER_TEXT}
                minLength={32}
                maxLength={32}
                className={classes.nameInput} />
        </>
    );
}
