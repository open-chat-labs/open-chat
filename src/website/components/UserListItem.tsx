import React from "react";
import { ListItem, ListItemIcon, makeStyles, Theme, Typography } from "@material-ui/core";
import { Option } from "../domain/model/common";
import UserAvatar from "./UserAvatar";
import { UserItem } from "../domain/model/users";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(UserListItem, shouldSkipRerender);

type Props = {
    user: UserItem,
    handleSelectUser: Option<() => void>,
    buttons: Option<MenuButton[]>
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
    selectable: theme.selectableListItem,
    username: {
        paddingLeft: 10,
        width: "100%"
    }
}));

function UserListItem(props: Props) {
    const classes = useStyles();
    let className = "user-list-item down-arrow-container";
    if (props.handleSelectUser) {
        className += " " + classes.selectable;
    }

    return (
        <ListItem onClick={_ => props.handleSelectUser ? props.handleSelectUser() : null} className={className} divider={true}>
            <ListItemIcon>
                <UserAvatar
                    userId={props.user.username}
                    imageId={props.user.imageId}
                    isUserOnline={props.user.isOnline}
                    size="md" />
            </ListItemIcon>
            <Typography variant="body1" className={classes.username}>{props.user.username}</Typography>
            {props.buttons
                ? <DropDownMenu menuId={props.user.userId} useDownArrow={true} buttons={props.buttons} />
                : null}
        </ListItem>
    );
}
