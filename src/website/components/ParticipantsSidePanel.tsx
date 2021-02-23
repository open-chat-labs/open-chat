import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import * as sortFunctions from "../utils/sortFunctions";
import { getSelectedChat, getUsers } from "../domain/stateFunctions";
import { changeRightPanel, RightPanelType } from "../actions/changeSidePanel";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import UserListItem from "./UserListItem";
import { fromMyProfile, fromUserSummary, UserId, UserItem, UserSummary } from "../domain/model/users";
import { ConfirmedGroupChat } from "../domain/model/chats";
import gotoUser from "../actions/chats/gotoUser";
import { MenuButton } from "./DropDownMenu";
import removeParticipant from "../actions/chats/removeParticipant";

export default React.memo(ParticipantsSidePanel);

function ParticipantsSidePanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as ConfirmedGroupChat);
    const me = useSelector((state: RootState) => state.usersState.me!);
    const _users = useSelector((state: RootState) => getUsers(chat.participants, state.usersState.userDictionary), compareUsers);

    // Sort participants alphabetically by username
    const users = _users.map(fromUserSummary);
    users.sort(sortFunctions.compareBy("username"));

    function closePanel() {
        dispatch(changeRightPanel(RightPanelType.None));
    }

    const handleSelectUser = (user: UserItem) => () => {
        if (user.userId != me.userId) {
            closePanel();
            dispatch(gotoUser(user.userId, user.username));
        }
    }

    const buttons: MenuButton[] = [];
    buttons.push({text: "Remove", action: (userId: string) => dispatch(removeParticipant(chat.chatId, userId as UserId))});
    buttons.push({text: "Dismiss as admin", action: () => null});

    function compareUsers(left: UserSummary[], right: UserSummary[]): boolean {
        if (left.length !== right.length)
            return false;

        for (let i = 0; i < left.length; i++) {
            const l = left[i];
            const r = right[i];
            if (l.userId !== r.userId || l.username !== r.username || l.imageId !== r.imageId)  {
                return false;
            }
        }

        return true;
    }

    return (
        <>
            <header>
                <div className="title-container">
                    <div className="ddl-button" onClick={_ => closePanel()}>
                        <CancelIcon className="ddl-button-svg" />
                    </div>
                    <div className="title">Participants</div>
                </div>                
            </header>

            <ul className="chats">
                <li onClick={_ => dispatch(changeRightPanel(RightPanelType.AddParticpants))}>
                    <div className="icon-container">
                        <div className="new-chat-icon"><CreateGroupChatIcon /></div>
                    </div>
                    <div className="action-container">
                        <div className="name">Add participant</div>
                    </div>
                </li>

                <UserListItem 
                    key={me.userId} 
                    user={fromMyProfile(me)} />

                {users.map(user => <UserListItem 
                    key={user.userId} 
                    user={user} 
                    buttons={buttons} 
                    handleSelectUser={handleSelectUser(user)} />)}
            </ul>
        </>
    );
}
