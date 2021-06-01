import React from "react";
import { useDispatch, useSelector } from "react-redux";
import makeStyles from "@material-ui/styles/makeStyles";
import { darken } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Container from "@material-ui/core/Container";
import { RootState } from "../../reducers";
import { getSelectedChat } from "../../domain/stateFunctions";
import * as chatFunctions from "../../domain/model/chats";
import { cancelReplyToMessage } from "../../actions/chats/replyToMessage";
import CloseButton from "../shared/CloseButton";
import MessageReplyPanel from "./MessageReplyPanel";

export default React.memo(ReplyToMessagePanel);

const useStyles = makeStyles<Theme>((theme: Theme) => ({
    container: {
        paddingLeft: 16,
        paddingRight: 16,
    },
    innerContainer: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8
    },
    contentContainer: {
        maxWidth: 500,
        [theme.breakpoints.down('sm')]: {
            maxWidth: "87vw"
        },
        backgroundColor: darken(theme.colors.messageSentByElse.highlightedContentBackgroundColor, 0.05),
        borderRadius: 6,
        "& svg": {
            opacity: 0.7
        }
    },
    closeButton: {
        marginLeft: 16
    }
}));

function ReplyToMessagePanel() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const userMap = useSelector((state: RootState) => state.usersState.userDictionary);
    const replyContext = chat?.replyContext;

    let panel = null;
    if (chat && replyContext) {
        const repliesToMyMessage = myUserId === replyContext.userId;
        const repliesToUsername = !repliesToMyMessage && userMap.hasOwnProperty(replyContext.userId)
            ? userMap[replyContext.userId].username
            : null;
        let theirUsername;
        if (chatFunctions.isDirectChat(chat)) {
            theirUsername = userMap.hasOwnProperty(chat.them)
            ? userMap[chat.them].username
            : null;
        }

        panel = 
            <div className={classes.innerContainer}>
                <MessageReplyPanel
                    repliesToChatId={replyContext.chatId}
                    isPrivateReply={chat.chatId !== replyContext.chatId}
                    content={replyContext.content}
                    repliesToMyMessage={repliesToMyMessage}
                    sentByMe={false}
                    isGroupChat={chatFunctions.isGroupChat(chat)}
                    theirUsername={theirUsername}
                    repliesToUsername={repliesToUsername}
                    className={classes.contentContainer}
                />            
                <CloseButton className={classes.closeButton} onClick={closePanel} />
            </div>;
    }

    function closePanel() {
        dispatch(cancelReplyToMessage(chat!.chatId));
    }

    return (
        <Container className={classes.container}>
            {panel}
        </Container>
    );
}