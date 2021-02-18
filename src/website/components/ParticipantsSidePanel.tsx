import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import * as sortFunctions from "../utils/sortFunctions";
import { getSelectedChat, getUsers } from "../domain/stateFunctions";
import { changeRightPanel, RightPanelType } from "../actions/changeSidePanel";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import UserListItem from "./UserListItem";
import { toUserSummary, UserId, UserSummary } from "../domain/model/users";
import { ConfirmedGroupChat } from "../domain/model/chats";
import gotoUser from "../actions/chats/gotoUser";
import { MenuButton } from "./DropDownMenu";
import removeParticipant from "../actions/chats/removeParticipant";

export default React.memo(ParticipantsSidePanel);

function ParticipantsSidePanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as ConfirmedGroupChat);
    const me = useSelector((state: RootState) => state.usersState.me!);
    let users = useSelector((state: RootState) => getUsers(chat.participants, state.usersState.userDictionary));

    // Sort participants alphabetically by username
    users.sort(sortFunctions.compareBy("username"));

    // Add "me" to top of list
    let mySummary = toUserSummary(me);
    mySummary.username = "You";
    users.unshift(mySummary);

    function closePanel() {
        dispatch(changeRightPanel(RightPanelType.None));
    }

    function handleSelectUser(user: UserSummary) {
        closePanel();
        dispatch(gotoUser(user));
    }

    const buttons: MenuButton[] = [];
    buttons.push({text: "Remove", action: (userId: string) => dispatch(removeParticipant(chat.chatId, userId as UserId))});
    buttons.push({text: "Dismiss as admin", action: () => null});

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
                {users.map(user => <UserListItem 
                    userSummary={user} 
                    handleSelectUser={() => handleSelectUser(user)} 
                    buttons={user.userId != me.userId ? buttons : null} />)}
            </ul>
        </>
    );
}
