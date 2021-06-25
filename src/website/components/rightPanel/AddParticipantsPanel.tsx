import React, { useLayoutEffect, useRef, useState } from "react";
import * as clipboard from "clipboard-polyfill/text";
import { useDispatch, useSelector } from "react-redux";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import { RootState } from "../../reducers";
import { getSelectedChat } from "../../domain/stateFunctions";
import { changeRightPanel } from "../../actions/app/changeSidePanel";
import userMgmtService from "../../services/userMgmt/service";
import addParticipants from "../../actions/chats/addParticipants";
import SearchBox from "../shared/SearchBox";
import * as u64 from "../../utils/u64Functions";
import UserListItem from "../shared/UserListItem";
import { fromUserSummary, UserSummary } from "../../domain/model/users";
import { SearchUsersRequest } from "../../services/userMgmt/searchUsers";
import { GroupChat } from "../../domain/model/chats";
import Header from "./Header";
import CreateGroupChatIcon from "../shared/CreateGroupChatIcon";
import { RightPanelType } from "../../domain/model/panels";

const PLACEHOLDER_TEXT = "Type a username";

export default React.memo(AddParticipantsPanel);

function AddParticipantsPanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as GroupChat);

    const emptyResults: UserSummary[] = [];
    const [text, setText] = useState("");
    const [results, setResults] = useState(emptyResults);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const tooltipTimeout = useRef<NodeJS.Timeout>();

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
                if (text.length > 0) {
                    setResults(response.users);
                }
            });
        } else {
            setResults(emptyResults);
        }
    }

    async function handleCopyCodeButtonClick() {
        if (tooltipTimeout.current) {
            clearTimeout(tooltipTimeout.current);
        }

        await clipboard.writeText(u64.toHex(chat.chatId));
        setTooltipOpen(true);
        tooltipTimeout.current = setTimeout(() => {
            setTooltipOpen(false);
            tooltipTimeout.current = undefined;
        }, 1000);
    }

    function closePanel() {
        clearInput();
        dispatch(changeRightPanel(RightPanelType.Participants));
    }

    function handleSelectUser(user: UserSummary) {
        closePanel();
        dispatch(addParticipants(chat, [user.userId]));
    }

    useLayoutEffect(() => {
        textBoxRef.current?.focus();
    }, []);

    let mainContent: JSX.Element;
    if (results.length) {
        mainContent = (
            <List disablePadding={true}>
                {results.map(user => <UserListItem
                    key={user.userId}
                    user={fromUserSummary(user)}
                    handleSelectUser={() => handleSelectUser(user)} />)}
            </List>
        );
    } else {
        mainContent = (
            <Tooltip title="copied!" placement="bottom" open={tooltipOpen}>
                <Button onClick={handleCopyCodeButtonClick}>Copy Invite Code</Button>
            </Tooltip>
        )
    }

    return (
        <>
            <Header
                title="Add participant"
                onCloseButtonClick={closePanel}
                rightIcon={<CreateGroupChatIcon size="sm" />}
                back={true} />
            <SearchBox
                text={text}
                onChange={handleInputChange}
                placeholderText={PLACEHOLDER_TEXT}
                ref={textBoxRef} />
            {mainContent}
        </>
    );
}
