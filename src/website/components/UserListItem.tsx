import React from "react";
import { Option } from "../domain/model/common";
import DefaultAvatar from "./DefaultAvatar";
import UserOnlineMarker from "./UserOnlineMarker";
import { UserSummary } from "../domain/model/users";
import DropDownMenu, { MenuButton } from "./DropDownMenu";

export default React.memo(UserListItem);

type Props = {
    userSummary: UserSummary,
    handleSelectUser: () => void,
    buttons: Option<MenuButton[]>
}

UserListItem.defaultProps = {
    buttons: null
};

function UserListItem(props: Props) {

    return (
        <li onClick={_ => props.handleSelectUser()} className="user-list-item down-arrow-container">
            <DefaultAvatar userId={props.userSummary.userId} />
            {props.userSummary.minutesSinceLastOnline < 2 ? <UserOnlineMarker /> : null }
            <div className="message-container">
                <div className="name">{props.userSummary.username}</div>
            </div>
            {props.buttons ? <DropDownMenu menuId={props.userSummary.userId as string} useDownArrow={true} buttons={props.buttons} /> :  null}
        </li>
    );
}
