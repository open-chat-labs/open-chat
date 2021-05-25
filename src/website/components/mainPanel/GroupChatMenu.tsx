import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { ChatId } from "../../domain/model/chats";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";
import leaveGroup from "../../actions/chats/leaveGroup";

export default React.memo(DirectChatMenu);

export interface Props {
    chatId: ChatId
}

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function DirectChatMenu(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Particpants)) });
    menuItems.push({ text: "Leave group", action: () => {
        if (confirm("Are you sure you want to leave this group?")) {
            dispatch(leaveGroup(props.chatId));
        }
    }});

    return <PopOverMenu icon={<MoreVertIcon className={classes.menuIcon} />} menuItems={menuItems} placement="bottom-end" />;
}
