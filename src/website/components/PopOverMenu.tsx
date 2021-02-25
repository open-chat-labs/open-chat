import React, {useRef, useState} from "react";
import {
    ClickAwayListener,
    IconButton,
    makeStyles,
    MenuItem,
    MenuList,
    Paper,
    Popper,
    PopperPlacementType,
    Theme,
    Typography
} from "@material-ui/core";
import { fade } from "@material-ui/core/styles/colorManipulator";

export default React.memo(PopOverMenu);

type Props = {
    icon: JSX.Element,
    menuItems: MenuItem[],
    placement: PopperPlacementType,
    className?: string
}

export type MenuItem = {
    text: string,
    action: () => void
}

const useStyles = makeStyles((theme: Theme) => ({
    button: {
        padding: 8
    },
    menu: {
        color: fade(theme.palette.text.primary, 0.8),
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
        event.stopPropagation();
        event.preventDefault();
        setOpen(!open);
    };

    const handleClose = () => {
        setOpen(false);
    };

    function buildMenuItemElement(text: string, action: () => void) : JSX.Element {
        return (
            <MenuItem onClick={event => {
                event.stopPropagation();
                action();
                handleClose();
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
                            className={classes.menu}>
                            {props.menuItems.map(m => buildMenuItemElement(m.text, m.action))}
                        </MenuList>
                    </ClickAwayListener>
                </Paper>
            </Popper>
        </>
    );
}
