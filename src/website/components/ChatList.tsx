import React from "react";
import { useSelector } from "react-redux";
import List from "@material-ui/core/List";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../reducers";
import * as chatListItemBuilder from "./ChatListItemBuilder";

export default React.memo(ChatList);

const useStyles = makeStyles((theme: Theme) => ({
    list: {
        overflow: "auto"
    }
}));

function ChatList() {
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const classes = useStyles();
    const selectedChatIndex = chatsState.selectedChatIndex;

    const chats = chatsState.chats.map((c, index) => {
        return chatListItemBuilder.build(c, userDictionary, index, selectedChatIndex);
    });

    return (
        <List disablePadding={true} className={classes.list}>
            {chats}
        </List>
    );
}
