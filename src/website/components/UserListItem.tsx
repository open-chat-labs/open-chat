import React from "react";
import { ListItem, ListItemIcon, makeStyles, Theme, Typography } from "@material-ui/core";
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
        position: "relative",
        "&:hover .show-on-hover": {
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

function UserListItem(props: Props) {
    const classes = useStyles();
    let className = classes.container;
    if (props.handleSelectUser) {
        className += " " + classes.selectable;
    }

    return (
        <ListItem onClick={_ => props.handleSelectUser ? props.handleSelectUser() : null} className={className} divider>
            <ListItemIcon>
                <UserAvatar
                    userId={props.user.username}
                    imageId={props.user.imageId}
                    isUserOnline={props.user.isOnline}
                    size="md" />
            </ListItemIcon>
            <Typography variant="body1" className={classes.username}>{props.user.username}</Typography>
            {props.buttons
                ? <PopOverMenu icon={<ExpandMoreIcon />} menuItems={props.buttons} placement="bottom-end" className={classes.menu + " show-on-hover"} />
                : null}
        </ListItem>
    );
}
