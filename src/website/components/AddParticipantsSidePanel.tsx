import React, { useLayoutEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import { getSelectedChat } from "../domain/stateFunctions";
import { changeRightPanel, RightPanelType } from "../actions/changeSidePanel";
import userMgmtService from "../services/userMgmt/service";
import { addParticipantsByUserId } from "../actions/chats/addParticipants";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import SearchBox from "./SearchBox";
import UserListItem from "./UserListItem";
import { UserSummary } from "../domain/model/users";
import { SearchUsersRequest } from "../services/userMgmt/searchUsers";
import { GroupChat } from "../domain/model/chats";

const PLACEHOLDER_TEXT = "Type a username";
const SEARCH_BOX_ID = "addParticipantsSearchBox";

export default React.memo(AddParticipantsSidePanel);

function AddParticipantsSidePanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as GroupChat);

    const emptyResults: UserSummary[] = [];
    const [text, setText] = useState("");
    const [results, setResults] = useState(emptyResults);
    const clearInput = () => setText("");

    function handleInputChange(text: string) {
        setText(text);

        if (text.length > 0) {
            const request: SearchUsersRequest = {
                search_term: text,
                max_results: 20
            };                
            userMgmtService.searchUsers(request).then(response => {
                setResults(response.users);
            });
        } else {
            setResults(emptyResults);
        }
    }

    function closePanel() {
        clearInput();
        dispatch(changeRightPanel(RightPanelType.Particpants));
    }

    function handleSelectUser(user: UserSummary) {
        closePanel();
        dispatch(addParticipantsByUserId(chat, [user.userId]));
    }

    useLayoutEffect(() => {
        document.getElementById(SEARCH_BOX_ID)?.focus();
    }, []);    

    return (
        <>
            <header>
                <div className="title-container">
                    <div className="ddl-button" onClick={_ => closePanel()}>
                        <CancelIcon className="ddl-button-svg" />
                    </div>
                    <div className="title">Add participants</div>
                </div>
                <div className="new-chat-icon"><CreateGroupChatIcon /></div>
            </header>
            <SearchBox id={SEARCH_BOX_ID} text={text} onChange={handleInputChange} defaultPlaceholderText={PLACEHOLDER_TEXT} />
            <ul className="chats">
                {results.map(user => <UserListItem userSummary={user} handleSelectUser={() => handleSelectUser(user)} />)}
            </ul>
        </>
    );
}
