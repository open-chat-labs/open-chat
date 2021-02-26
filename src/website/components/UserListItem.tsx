import React from "react";
import { ListItem, ListItemIcon, makeStyles, Theme, Typography, useTheme } from "@material-ui/core";
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Option } from "../domain/model/common";
import UserAvatar from "./UserAvatar";
import { UserItem } from "../domain/model/users";
import PopOverMenu, { MenuItem } from "./PopOverMenu";

export default React.memo(UserListItem, shouldSkipRerender);

type Props = {
    user: UserItem,
    handleSelectUser: Option<() => void>,
    buttons: Option<MenuItem[]>
}

UserListItem.defaultProps = {
    buttons: null,
    handleSelectUser: null
};

function shouldSkipRerender(p1: Props, p2: Props) {
    return p1.user.userId === p2.user.userId && 
        p1.user.username === p2.user.username && 
        p1.user.imageId === p2.user.imageId && 
        p1.user.isOnline === p2.user.isOnline;
}

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        backgroundColor: theme.customColors.sidePanelBackgroundColor,
        position: "relative",
        "&:hover .pop-over-menu-icon": {
            visibility: "visible"
        }
    },
    selectable: theme.selectableListItem,
    username: {
        paddingLeft: 10,
        width: "100%"
    },
    menu: {
        position: "absolute",
        padding: 6,
        top: 3,
        right: 3,
        visibility: "hidden"
    }
}));

const defaultOnClick: (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => void = _ => {};

function UserListItem(props: Props) {
    const classes = useStyles();
    const theme = useTheme();

    let className = classes.container;
    let onClick = defaultOnClick;
    if (props.handleSelectUser) {
        className += " " + classes.selectable;
        onClick = handleClick
    }

    function handleClick(event: React.MouseEvent<HTMLLIElement, MouseEvent>) {
        const element = event.target as HTMLElement;
        const clickedOnPopOver = element.closest(".pop-over-menu-icon, .pop-over-menu") !== null;
        if (!clickedOnPopOver) {
            props.handleSelectUser!();
        }
    }

    return (
        <ListItem onClick={onClick} className={className} divider>
            <ListItemIcon>
                <UserAvatar
                    userId={props.user.username}
                    imageId={props.user.imageId}
                    isUserOnline={props.user.isOnline}
                    size="md"
                    parentBackgroundColor={theme.customColors.sidePanelBackgroundColor} />
            </ListItemIcon>
            <Typography variant="body1" className={classes.username}>{props.user.username}</Typography>
            {props.buttons
                ? <PopOverMenu icon={<ExpandMoreIcon />} menuItems={props.buttons} placement="bottom-end" className={classes.menu + " pop-over-menu-icon"} />
                : null}
        </ListItem>
    );
}
