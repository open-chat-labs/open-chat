import React from "react";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";

export default React.memo(DirectChatMenu);

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function DirectChatMenu() {
    const classes = useStyles();
    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Contact info", action: () => {} });
    menuItems.push({ text: "Mute notifications", action: () => {} });
    menuItems.push({ text: "Delete chat", action: () => {} });

    return <PopOverMenu
        icon={<MoreVertIcon className={classes.menuIcon} />}
        menuItems={menuItems}
        placement="bottom-end" />;
}
