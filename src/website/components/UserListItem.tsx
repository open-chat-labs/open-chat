import React from "react";
import { Option } from "../domain/model/common";
import UserAvatar from "./UserAvatar";
import { UserItem } from "../domain/model/users";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(UserListItem, shouldSkipRerender);

type Props = {
    user: UserItem,
    handleSelectUser: () => void,
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

function UserListItem(props: Props) {
    return (
        <li onClick={_ => props.handleSelectUser ? props.handleSelectUser() : null} className="user-list-item down-arrow-container">
            <UserAvatar
                userId={props.user.username}
                imageId={props.user.imageId}
                isUserOnline={props.user.isOnline} />
            <div className="message-container">
                <div className="name">{props.user.username}</div>
            </div>
            {props.buttons ? <DropDownMenu menuId={props.user.userId as string} useDownArrow={true} buttons={props.buttons} /> :  null}
        </li>
    );
}
