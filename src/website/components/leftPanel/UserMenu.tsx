import React from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import PopOverMenu, { MenuItem } from "../PopOverMenu";

export default React.memo(UserMenu);

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function UserMenu() {
    const dispatch = useDispatch();
    const classes = useStyles();

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "New chat", action: () => dispatch(changeLeftPanel(LeftPanelType.NewDirectChat)) });
    menuItems.push({ text: "New group", action: () => dispatch(changeLeftPanel(LeftPanelType.NewGroupChat)) });
    menuItems.push({ text: "Profile", action: () => {} });
    menuItems.push({ text: "Settings", action: () => {} });
    menuItems.push({ text: "Logout", action: () => {} });

    return <PopOverMenu icon={<MoreVertIcon className={classes.menuIcon} />} placement="bottom-start" menuItems={menuItems} />;
}

