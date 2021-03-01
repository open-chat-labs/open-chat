import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { alpha, ListItem, makeStyles, Theme, Typography } from "@material-ui/core";
import { ChatId } from "../domain/model/chats";
import * as chatFunctions from "../domain/model/chats";
import * as stateFunctions from "../domain/stateFunctions";
import { LocalMessage } from "../domain/model/messages";
import { RootState } from "../reducers";
import selectChat from "../actions/chats/selectChat";
import { formatMessageDate } from "../formatters/date";
import TextContent from "./TextContent";
import { getContentAsText } from "../domain/messageFunctions";

export default React.memo(MessageSearchMatch);

type Props = {
    chatId: ChatId,
    message: LocalMessage,
    searchTerm: string
}

const useStyles = makeStyles((theme: Theme) => ({
    selectable: theme.selectableListItem,
    messageSummary: {
        width: "100%"
    },
    chatName: {
        color: theme.customColors.textColor
    },
    messageSnippet: {
        color: alpha(theme.customColors.textColor, 0.6),
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 450
    },
    date: {
        color: alpha(theme.customColors.textColor, 0.6),
        float: "right"
    }
}));

function MessageSearchMatch(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles();

    const [chat, index] = useSelector((state: RootState) =>
        chatFunctions.getChatById(state.chatsState.chats, props.chatId));

    const userDictionary = useSelector((state: RootState) => state.usersState.userDictionary);

    let chatName: string;
    if (chatFunctions.isDirectChat(chat)) {
        chatName = stateFunctions.getUserSummary(chat.them, userDictionary)?.username ?? "";
    } else {
        chatName = chat.subject;
    }

    return (
        <ListItem onClick={() => dispatch(selectChat(index, props.message.id))} className={classes.selectable} divider>
            <div className={classes.messageSummary}>
                <div>
                    <Typography variant="caption" className={classes.date}>{formatMessageDate(props.message.date)}</Typography>
                    <Typography variant="body1" className={classes.chatName}>{chatName}</Typography>
                </div>
                <div>
                    <div className={classes.messageSnippet}>
                        <TextContent text={getContentAsText(props.message.content)} variant="body2" insertLineBreaks={false} />
                    </div>
                </div>
            </div>
        </ListItem>
    );
}
