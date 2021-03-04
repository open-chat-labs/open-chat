import React, { useLayoutEffect, useState } from "react";
import { useDispatch } from "react-redux";
import List from "@material-ui/core/List";
import { changeLeftPanel, LeftPanelType } from "../../actions/changeSidePanel";
import userMgmtService from "../../services/userMgmt/service";
import { SearchUsersRequest } from "../../services/userMgmt/searchUsers";
import { fromUserSummary, UserSummary } from "../../domain/model/users";
import gotoUser from "../../actions/chats/gotoUser";
import SearchBox from "../SearchBox";
import UserListItem from "../UserListItem";
import Header from "./Header";
import CancelButton from "../CancelButton";
import CreateGroupChatIcon from "../CreateGroupChatIcon";

const PLACEHOLDER_TEXT = "Type a username";
const SEARCH_BOX_ID = "newDirectChatSearchBox";

export default React.memo(NewDirectChatPanel);

function NewDirectChatPanel() {
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

    function closePanel() {
        clearInput();
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSelectUser(user: UserSummary) {
        closePanel();
        dispatch(gotoUser(user.userId, user.username));
    }

    useLayoutEffect(() => {
        document.getElementById(SEARCH_BOX_ID)?.focus();
    }, []);

    return (
        <>
            <Header leftIcon={<CreateGroupChatIcon size="sm" />} title="Start a new chat" rightIcon={<CancelButton onClick={closePanel} />} />
            <SearchBox id={SEARCH_BOX_ID} text={text} onChange={handleInputChange} defaultPlaceholderText={PLACEHOLDER_TEXT} />
            <List disablePadding={true}>
                {results.map(user => <UserListItem
                    key={user.userId}
                    user={fromUserSummary(user)}
                    handleSelectUser={() => handleSelectUser(user)} />)}
            </List>
        </>
    );
}
