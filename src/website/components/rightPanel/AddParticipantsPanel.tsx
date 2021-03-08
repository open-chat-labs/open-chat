import React, { useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import List from "@material-ui/core/List";

import { RootState } from "../../reducers";
import { getSelectedChat } from "../../domain/stateFunctions";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";
import userMgmtService from "../../services/userMgmt/service";
import { addParticipantsByUserId } from "../../actions/chats/addParticipants";
import SearchBox from "../SearchBox";
import UserListItem from "../UserListItem";
import { fromUserSummary, UserSummary } from "../../domain/model/users";
import { SearchUsersRequest } from "../../services/userMgmt/searchUsers";
import { GroupChat } from "../../domain/model/chats";
import Header from "./Header";
import CreateGroupChatIcon from "../CreateGroupChatIcon";

const PLACEHOLDER_TEXT = "Type a username";

export default React.memo(AddParticipantsPanel);

function AddParticipantsPanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as GroupChat);

    const emptyResults: UserSummary[] = [];
    const [text, setText] = useState("");
    const [results, setResults] = useState(emptyResults);
    const clearInput = () => setText("");
    const textBoxRef = useRef<HTMLInputElement>(null);

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
        textBoxRef.current?.focus();
    }, []);

    return (
        <>
            <Header
                title="Add participants"
                onCloseButtonClick={closePanel}
                rightIcon={<CreateGroupChatIcon size="sm" />}
                back={true} />
            <SearchBox
                text={text}
                onChange={handleInputChange}
                placeholderText={PLACEHOLDER_TEXT}
                ref={textBoxRef} />
            <List disablePadding={true}>
                {results.map(user => <UserListItem
                    key={user.userId}
                    user={fromUserSummary(user)}
                    handleSelectUser={() => handleSelectUser(user)} />)}
            </List>
        </>
    );
}
