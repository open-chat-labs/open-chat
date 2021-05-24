import React from "react";
import { useDispatch, useSelector } from "react-redux";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { ChatId } from "../../domain/model/chats";
import * as chatFunctions from "../../domain/model/chats";
import * as stateFunctions from "../../domain/stateFunctions";
import { LocalMessage } from "../../domain/model/messages";
import { RootState } from "../../reducers";
import { gotoChatByIndex } from "../../actions/chats/gotoChat";
import { formatMessageDate } from "../../formatters/date";
import TextContent from "../shared/TextContent";
import { getContentAsText } from "../../domain/messageFunctions";

export default React.memo(MessageSearchMatch);

type Props = {
    chatId: ChatId,
    message: LocalMessage,
    searchTerm: string
}

const useStyles = makeStyles((theme: Theme) => ({
    listItem: {
        "&:hover": {
            backgroundColor: theme.colors.sidePanel.listItemHoverBackgroundColor,
            cursor: "pointer"
        }
    },
    messageSummary: {
        width: "100%"
    },
    messageSnippet: {
        color: alpha(theme.colors.textColor, 0.6),
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 450
    },
    date: {
        color: alpha(theme.colors.textColor, 0.6),
        float: "right"
    }
}));

function MessageSearchMatch(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles();

    const [chat, index] = useSelector((state: RootState) =>
        chatFunctions.getChat(state.chatsState.chats, props.chatId));

    const userDictionary = useSelector((state: RootState) => state.usersState.userDictionary);

    let chatName: string;
    if (chatFunctions.isDirectChat(chat)) {
        chatName = stateFunctions.getUserSummary(chat.them, userDictionary)?.username ?? "";
    } else {
        chatName = chat.subject;
    }

    return (
        <ListItem onClick={() => dispatch(gotoChatByIndex(index, props.message.id))} className={classes.listItem} divider>
            <div className={classes.messageSummary}>
                <div>
                    <Typography variant="caption" className={classes.date}>{formatMessageDate(props.message.date)}</Typography>
                    <Typography variant="body1">{chatName}</Typography>
                </div>
                <div>
                    <div className={classes.messageSnippet}>
                        <TextContent text={getContentAsText(props.message.content)} variant="body2" plainText={true} />
                    </div>
                </div>
            </div>
        </ListItem>
    );
}
