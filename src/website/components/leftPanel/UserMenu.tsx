import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel } from "../../actions/app/changeSidePanel";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import ThemeSelector from "./ThemeSelector";
import logout from "../../actions/signin/logout";
import { alertDialog } from "../../components/modals/Alert";
import { LeftPanelType } from "../../domain/model/panels";
import { ABOUT_US } from "../../constants";

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
    menuItems.push({ text: "Join group", action: () => dispatch(changeLeftPanel(LeftPanelType.JoinGroupChat)) });
    menuItems.push({ text: "Theme", action: () => setThemeSelectorOpen(true) });
    menuItems.push({ text: "Internet Identity", action: () => window.open(process.env.IDP_URL, "_blank") });
    menuItems.push({ text: "TEST MODE", action: () => alertDialog(ABOUT_US) });
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

