import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import PopOverMenu, { MenuItem } from "../PopOverMenu";
import ThemeSelector from "../ThemeSelector";
import logout from "../../actions/logout";

export default React.memo(UserMenu);

const useStyles = makeStyles((theme: Theme) => ({
    menuIcon: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function UserMenu() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);

    const menuItems: MenuItem[] = [];
    menuItems.push({ text: "New chat", action: () => dispatch(changeLeftPanel(LeftPanelType.NewDirectChat)) });
    menuItems.push({ text: "New group", action: () => dispatch(changeLeftPanel(LeftPanelType.NewGroupChat)) });
    menuItems.push({ text: "Profile", action: () => {} });
    menuItems.push({ text: "Theme", action: () => setThemeSelectorOpen(true) });
    menuItems.push({ text: "Logout", action: () => dispatch(logout()) });

    return (
        <>
            <PopOverMenu icon={<MoreVertIcon className={classes.menuIcon} />} placement="bottom-start" menuItems={menuItems} />
            {themeSelectorOpen
                ? <ThemeSelector onClose={() => setThemeSelectorOpen(false)} />
                : null}
        </>
    );
}

