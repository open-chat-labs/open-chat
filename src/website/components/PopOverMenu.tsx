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
import MoreVertIcon from "@material-ui/icons/MoreVert";

export default React.memo(PopOverMenu);

type Props = {
    menuItems: MenuItem[],
    placement: PopperPlacementType
}

export type MenuItem = {
    title: string,
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

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setOpen(!open);
    };

    const handleClose = () => {
        setOpen(false);
    };

    function buildMenuItemElement(text: string, action: () => void) : JSX.Element {
        return (
            <MenuItem onClick={() => {
                action();
                handleClose();
            }}>
                <Typography variant="body2">{text}</Typography>
            </MenuItem>
        );
    }

    return (
        <>
            <IconButton onClick={handleClick} buttonRef={anchorRef} className={classes.button}>
                <MoreVertIcon />
            </IconButton>
            <Popper open={open} anchorEl={anchorRef.current} placement={props.placement} className={classes.popper}>
                <Paper>
                    <ClickAwayListener onClickAway={handleClose}>
                        <MenuList
                            variant="menu"
                            className={classes.menu}>
                            {props.menuItems.map(m => buildMenuItemElement(m.title, m.action))}
                        </MenuList>
                    </ClickAwayListener>
                </Paper>
            </Popper>
        </>
    );
}
