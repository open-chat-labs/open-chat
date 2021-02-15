import React, { useState } from "react";
import { useDispatch } from "react-redux";
import changeSidePanel, { SidePanelType } from "../actions/changeSidePanel";
import userMgmtService from "../services/userMgmt/service";
import CancelIcon from "../assets/icons/cancelIcon.svg";
import CreateGroupChatIcon from "../assets/icons/createGroupChat.svg";
import { SearchUsersRequest } from "../services/userMgmt/searchUsers";
import { UserSummary } from "../domain/model/users";
import DefaultAvatar from "./DefaultAvatar";
import UserOnlineMarker from "./UserOnlineMarker";
import SearchIcon from "../assets/icons/search.svg";
import gotoUser from "../actions/chats/gotoUser";

const PLACEHOLDER_TEXT = "Type a username";

export default React.memo(NewDirectChatSidePanel);

function NewDirectChatSidePanel() {
    const dispatch = useDispatch();

    const emptyResults: UserSummary[] = [];
    const [text, setText] = useState("");
    const [results, setResults] = useState(emptyResults);
    const [placeholderText, setPlaceholderText] = useState(PLACEHOLDER_TEXT);
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

    function handleSelectUser(item: UserSummary) {
        clearInput();
        dispatch(changeSidePanel(SidePanelType.Chats));
        dispatch(gotoUser(item));
    }

    return (
        <section id="newDirectChatSidePanel" className="sidebar">
            <header>
                <div className="new_chat_icon"><CreateGroupChatIcon /></div>
                <div className="my-display-name">Start a new chat</div>
                <div className="chats-menu-container">
                    <div className="ddl-button" onClick={_ => handleCancel()}>
                        <CancelIcon className="ddl-button-svg" />
                    </div>
                </div>
            </header>
            <div className="search">
                <input
                    value={text}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={placeholderText}
                    onFocus={_ => setPlaceholderText("")}
                    onBlur={_ => setPlaceholderText(PLACEHOLDER_TEXT)} />
                <SearchIcon />
            </div>
            <ul className="chats">
                {results.map((item, _) => (
                    <li onClick={_ => handleSelectUser(item)}>
                        <DefaultAvatar userId={item.userId} />
                        {item.minutesSinceLastOnline < 2 ? <UserOnlineMarker /> : null }
                        <div className="message-container">
                            <div className="name">{item.username}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
