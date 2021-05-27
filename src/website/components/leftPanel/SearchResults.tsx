import React, {useEffect, useState} from "react";
import { useSelector } from "react-redux";
import Box from "@material-ui/core/Box";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import List from "@material-ui/core/List";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import * as stateFunctions from "../../domain/stateFunctions";
import { Chat, ChatId } from "../../domain/model/chats";
import * as chatFunctions from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { LocalMessage } from "../../domain/model/messages";
import { UserId, UserSummary } from "../../domain/model/users";
import * as chatListItemBuilder from "./ChatListItemBuilder";
import MessageSearchMatch from "./MessageSearchMatch";
import chatsService from "../../services/chats/service";
import { SearchAllMessagesResponse } from "../../services/chats/searchAllMessages";

type Props = {
    searchTerm: string,
    clearSearchTerm: () => void
}

type MessageMatch = {
    chatId: ChatId,
    message: LocalMessage
}

const useStyles = makeStyles((theme: Theme) => ({
    searchResults: {
        overflow: "auto"
    },
    groupTitle: {
        padding: "4px 16px"
    }
}));

export default React.memo(SearchResults);

function SearchResults(props: Props) {
    const chats = useSelector((state: RootState) => state.chatsState.chats);
    const me = useSelector((state: RootState) => state.usersState.me?.userId) ?? "";
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const [messageMatches, setMessageMatches] = useState<MessageMatch[]>([]);
    const getUser = (userId: UserId) => stateFunctions.getUserSummary(userId, userDictionary);

    const chatMatches = searchChats(chats, props.searchTerm, getUser);

    useEffect(() => {
        // search messages
        chatsService
            .searchAllMessages(props.searchTerm, 20)
            .then((res: SearchAllMessagesResponse) => {
                if (res.kind === "success") {
                    const matches = res.result.matches;
                    setMessageMatches(matches);
                }
            })
    }, [props.searchTerm]);

    const classes = useStyles();

    function createGroup(title: string, items: JSX.Element[]) {
        return (
            <Grid item>
                <Box className={classes.groupTitle}>{title}</Box>
                <Divider />
                <List disablePadding={true}>
                    {items}
                </List>
            </Grid>
        );
    }

    const groups: JSX.Element[] = [];
    if (chatMatches.length) {
        groups.push(createGroup("Chats", chatMatches.map(([chat, index]) =>
            chatListItemBuilder.build(chat, userDictionary, index, null, me))));
    }

    if (messageMatches.length) {
        groups.push(createGroup("Messages", messageMatches.map(m => <MessageSearchMatch
            key={`${m.chatId}_${m.message.id}`}
            chatId={m.chatId}
            message={m.message}
            searchTerm={props.searchTerm} />)));
    }

    return (
        <Grid container direction="column" wrap="nowrap" className={classes.searchResults}>
            {groups}
        </Grid>
    );
}

function searchChats(chats: Chat[], searchTerm: string, getUser: (userId: UserId) => Option<UserSummary>) : [Chat, number][] {
    searchTerm = searchTerm.toLowerCase();

    const matches: [Chat, number][] = [];
    for (let index = 0; index < chats.length; index++) {
        const chat = chats[index];
        if (chatFunctions.isDirectChat(chat)) {
            const user = getUser(chat.them);
            if (user && user.username.toLowerCase().indexOf(searchTerm) >= 0) {
                matches.push([chat, index]);
            }
        } else if (chat.subject.toLowerCase().indexOf(searchTerm) >= 0) {
            matches.push([chat, index]);
        }
    }

    return matches;
}

function searchUsers(users: UserSummary[], searchTerm: string) : UserSummary[] {
    searchTerm = searchTerm.toLowerCase();

    return users.filter(u => u.username.toLowerCase().indexOf(searchTerm) >= 0);
}

function getUsersWithoutDirectChats(users: UserSummary[], chats: Chat[]) : UserSummary[] {
    const usersWithDirectChats = new Set<UserId>();
    for (const chat of chats.filter(chatFunctions.isDirectChat)) {
        usersWithDirectChats.add(chat.them);
    }

    return users.filter(u => !usersWithDirectChats.has(u.userId));
}
