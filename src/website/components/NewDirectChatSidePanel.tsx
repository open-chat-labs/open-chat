import React, { useState } from "react";
import { useDispatch } from "react-redux";
import changeSidePanel, { SidePanelType } from "../actions/changeSidePanel";
import userMgmtService from "../services/userMgmt/service";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import { SearchUsersRequest } from "../services/userMgmt/searchUsers";
import { UserSummary } from "../domain/model/users";
import gotoUser from "../actions/chats/gotoUser";
import SearchBox from "./SearchBox";
import UserListItem from "./UserListItem";

const PLACEHOLDER_TEXT = "Type a username";

export default React.memo(NewDirectChatSidePanel);

function NewDirectChatSidePanel() {
    const dispatch = useDispatch();

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

    function handleCancel() {
        clearInput();
        dispatch(changeSidePanel(SidePanelType.Chats));
    }

    function handleSelectUser(user: UserSummary) {
        clearInput();
        dispatch(changeSidePanel(SidePanelType.Chats));
        dispatch(gotoUser(user));
    }

    return (
        <section id="newDirectChatSidePanel" className="sidebar">
            <header>
                <div className="new-chat-icon"><CreateGroupChatIcon /></div>
                <div className="my-display-name">Start a new chat</div>
                <div className="chats-menu-container">
                    <div className="ddl-button" onClick={_ => handleCancel()}>
                        <CancelIcon className="ddl-button-svg" />
                    </div>
                </div>
            </header>
            <SearchBox text={text} onChange={handleInputChange} defaultPlaceholderText={PLACEHOLDER_TEXT} />
            <ul className="chats">
                {results.map(user => <UserListItem userSummary={user} handleSelectUser={() => handleSelectUser(user)} />)}
            </ul>
        </section>
    );
}
