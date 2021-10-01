import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { ChatId } from "../../domain/model/chats";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import { changeRightPanel } from "../../actions/app/changeSidePanel";
import leaveGroup from "../../actions/chats/leaveGroup";
import { RightPanelType } from "../../domain/model/panels";
import { markAllMessagesAsReadLocally } from "../../actions/chats/markMessagesAsRead";
import { toggleNotifications } from "../../actions/chats/toggleNotifications";

export default React.memo(GroupChatMenu);

export interface Props {
    chatId: ChatId,
    muted: boolean,
    any_unread: boolean,
}

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function GroupChatMenu(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Participants)) });
    menuItems.push({ text: props.muted ? "Unmute notifications" : "Mute notifications", action: () => dispatch(toggleNotifications(props.chatId, !props.muted)) });
    menuItems.push({ text: "Mark all as read", action: () => dispatch(markAllMessagesAsReadLocally(props.chatId)), disable: !props.any_unread });
    menuItems.push({ text: "Leave group", action: () => {
        if (confirm("Are you sure you want to leave this group?")) {
            dispatch(leaveGroup(props.chatId));
        }
    }});

    return <PopOverMenu icon={<MoreVertIcon className={classes.menuIcon} />} menuItems={menuItems} placement="bottom-end" />;
}
