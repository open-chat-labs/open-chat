import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import { ChatId } from "../../domain/model/chats";
import { UserId } from "../../domain/model/users";
import { blockUser } from "../../actions/chats/blockUser";
import { markAllMessagesAsReadLocally } from "../../actions/chats/markMessagesAsRead";
import { toggleNotifications } from "../../actions/chats/toggleNotifications";

export default React.memo(DirectChatMenu);

type Props = {
    chatId: ChatId,
    userId: UserId,
    muted: boolean,
    any_unread: boolean,
}

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function DirectChatMenu(props: Props) {
    const dispatch = useDispatch();
    const unblock = useSelector((state: RootState) => state.chatsState.blockedUsers).includes(props.userId);
    const classes = useStyles();
    const menuItems: MenuItem[] = [];
    // menuItems.push({ text: "Contact info", action: () => {} });
    menuItems.push({ text: props.muted ? "Unmute notifications" : "Mute notifications", action: () => dispatch(toggleNotifications(props.chatId, !props.muted)) });
    // menuItems.push({ text: "Delete chat", action: () => {} });
    menuItems.push({ text: unblock ? "Unblock user" : "Block user", action: () => dispatch(blockUser(props.userId, unblock)) });
    menuItems.push({ text: "Mark all as read", action: () => dispatch(markAllMessagesAsReadLocally(props.chatId)), disable: !props.any_unread });

    return <PopOverMenu
        icon={<MoreVertIcon className={classes.menuIcon} />}
        menuItems={menuItems}
        placement="bottom-end" />;
}
