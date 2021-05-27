import React, { useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import List from "@material-ui/core/List";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { changeLeftPanel } from "../../actions/app/changeSidePanel";
import userMgmtService from "../../services/userMgmt/service";
import { SearchUsersRequest } from "../../services/userMgmt/searchUsers";
import { fromUserSummary, UserSummary } from "../../domain/model/users";
import gotoUser from "../../actions/chats/gotoUser";
import SearchBox from "../shared/SearchBox";
import UserListItem from "../shared/UserListItem";
import Header from "./Header";
import CloseButton from "../shared/CloseButton";
import CreateGroupChatIcon from "../shared/CreateGroupChatIcon";
import { LeftPanelType } from "../../domain/model/panels";

const PLACEHOLDER_TEXT = "Type a username";

export default React.memo(NewDirectChatPanel);

const useStyles = makeStyles((theme: Theme) => ({
    closeButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
    }
}));

function NewDirectChatPanel() {
    const dispatch = useDispatch();
    const classes = useStyles();

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
        dispatch(changeLeftPanel(LeftPanelType.Chats));
    }

    function handleSelectUser(user: UserSummary) {
        closePanel();
        dispatch(gotoUser(user));
    }

    useLayoutEffect(() => {
        textBoxRef.current?.focus();
    }, []);

    return (
        <>
            <Header
                leftIcon={<CreateGroupChatIcon size="sm" />}
                title="Start a new chat"
                rightIcon={<CloseButton onClick={closePanel} className={classes.closeButton} />} />
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
