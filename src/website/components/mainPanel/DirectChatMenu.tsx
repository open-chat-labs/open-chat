import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import { UserId } from "../../domain/model/users";
import { blockUser } from "../../actions/chats/blockUser";

export default React.memo(DirectChatMenu);

type Props = {
    userId: UserId,
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
    // menuItems.push({ text: "Mute notifications", action: () => {} });
    // menuItems.push({ text: "Delete chat", action: () => {} });
    menuItems.push({ text: unblock ? "Unblock user" : "Block user", action: () => dispatch(blockUser(props.userId, unblock)) });

    return <PopOverMenu
        icon={<MoreVertIcon className={classes.menuIcon} />}
        menuItems={menuItems}
        placement="bottom-end" />;
}
