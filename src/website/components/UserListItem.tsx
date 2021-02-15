import React from "react";
import DefaultAvatar from "./DefaultAvatar";
import UserOnlineMarker from "./UserOnlineMarker";
import { UserSummary } from "../domain/model/users";

export default React.memo(UserListItem);

type Props = {
    userSummary: UserSummary,
    handleSelectUser: () => void
}

function UserListItem(props: Props) {
    return (
        <li onClick={_ => props.handleSelectUser()}>
            <DefaultAvatar userId={props.userSummary.userId} />
            {props.userSummary.minutesSinceLastOnline < 2 ? <UserOnlineMarker /> : null }
            <div className="message-container">
                <div className="name">{props.userSummary.username}</div>
            </div>
        </li>
    );
}
