import React, { useRef, useState } from "react";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import Paper from "@material-ui/core/Paper";
import Popper, { PopperPlacementType } from "@material-ui/core/Popper";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(PopOverMenu);

type Props = {
    icon: JSX.Element,
    menuItems: MenuItem[],
    placement: PopperPlacementType,
    className?: string
}

export type MenuItem = {
    text: string,
    action: () => void,
    disable?: boolean,
}

const useStyles = makeStyles((theme: Theme) => ({
    button: {
        height: theme.avatarSize.sm,
        width: theme.avatarSize.sm
    },
    menu: {
        color: alpha(theme.colors.textColor, 0.8),
        backgroundColor: alpha(theme.colors.sidePanel.backgroundColor, 0.8),
        minWidth: 160
    },
    popper: {
        zIndex: 100
    }
}));

function PopOverMenu(props: Props) {
    const classes = useStyles();
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLElement>(null);
    let buttonClassName = classes.button;
    if (props.className) {
        buttonClassName += " " + props.className;
    }

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setOpen(!open);
    };

    const handleClose = () => {
        setOpen(false);
    };

    function buildMenuItemElement(text: string, action: () => void, disable?: boolean) : JSX.Element {
        return (
            <MenuItem key={text} disabled={disable} onClick={_ => {
                    if (!disable) {
                        action();
                        handleClose();
                    }
                }}>
                <Typography variant="body2">{text}</Typography>
            </MenuItem>
        );
    }

    return (
        <>
            <IconButton onClick={handleClick} buttonRef={anchorRef} className={buttonClassName}>
                {props.icon}
            </IconButton>
            <Popper open={open} anchorEl={anchorRef.current} placement={props.placement} className={classes.popper}>
                <Paper>
                    <ClickAwayListener onClickAway={handleClose}>
                        <MenuList
                            variant="menu"
                            className={classes.menu + " pop-over-menu"}>
                            {props.menuItems.map(m => buildMenuItemElement(m.text, m.action, m.disable))}
                        </MenuList>
                    </ClickAwayListener>
                </Paper>
            </Popper>
        </>
    );
}
