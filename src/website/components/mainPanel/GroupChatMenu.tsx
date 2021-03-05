import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import PopOverMenu, { MenuItem } from "../PopOverMenu";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";

export default React.memo(DirectChatMenu);

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function DirectChatMenu() {
    const dispatch = useDispatch();
    const classes = useStyles();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "Participants", action: () => dispatch(changeRightPanel(RightPanelType.Particpants)) });
    menuItems.push({ text: "Mute notifications", action: () => {} });
    menuItems.push({ text: "Leave group", action: () => {} });

    return <PopOverMenu icon={<MoreVertIcon className={classes.menuIcon} />} menuItems={menuItems} placement="bottom-end" />;
}
