import React, { useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Grid from "@material-ui/core/Grid";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import * as chatFunctions from "../../domain/model/chats";
import { ChatId, ConfirmedChat } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { Message, RemoteMessage } from "../../domain/model/messages";
import { PAGE_SIZE } from "../../constants";
import getMessages from "../../actions/chats/getMessages";
import { areOnSameDay } from "../../utils/dateFunctions";
import { getSelectedChat } from "../../domain/stateFunctions";
import MessagesFromSingleDay from "./MessagesFromSingleDay";
import UnreadMessageDetector from "../../domain/UnreadMessageDetector";
import UnreadMessagesHandler from "../../domain/UnreadMessagesHandler";
import { UserId } from "../../domain/model/users";
import ScrollToBottomButton from "./ScrollToBottomButton";

export default React.memo(MessagesList);

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto"
    },
    messagesList: {
        padding: "14px 14px 0 14px"
    },
    scrollToBottomButton: {
        position: "absolute",
        bottom: 8,
        right: 24,
        zIndex: 100,
        color: theme.colors.iconAlt.color,
        backgroundColor: theme.colors.iconAlt.backgroundColor,
        "&:hover,:focus": {
            backgroundColor: theme.colors.iconAlt.hover
        }
    }
}));

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me!.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));
    const classes = useStyles();
    const messageIdToSelect = chat && chatFunctions.isConfirmedChat(chat) ? chat.messageToSelect : null;

    if (chat === null) {
        return <div></div>;
    }

    const isGroupChat = chatFunctions.isGroupChat(chat);
    const theirUserId: Option<UserId> = chatFunctions.isDirectChat(chat) ? chat.them : null;
    let chatId: Option<ChatId> = chatFunctions.isConfirmedChat(chat) ? chat.chatId : null;

    const children: JSX.Element[] = [];

    const unreadMessageDetector = new UnreadMessageDetector(chat);

    // Ignore remote messages
    const messages = chat.messages.filter(m => m.kind !== "remote") as (Exclude<Message, RemoteMessage>)[];

    let messagesFromSameDay: (Exclude<Message, RemoteMessage>)[] = [];
    let lastMessageDate: Option<Date> = null;
    for (const message of messages) {
        if (lastMessageDate && !areOnSameDay(lastMessageDate, message.date)) {
            addDay(lastMessageDate, messagesFromSameDay);
            messagesFromSameDay = [];
        }
        messagesFromSameDay.push(message);
        lastMessageDate = message.date;
    }

    if (messagesFromSameDay.length) {
        addDay(lastMessageDate!, messagesFromSameDay);
    }

    function addDay(date: Date, messages: Exclude<Message, RemoteMessage>[]) {
        children.push(<MessagesFromSingleDay
            chatId={chatId}
            key={date.toDateString()}
            isGroupChat={isGroupChat}
            myUserId={myUserId}
            theirUserId={theirUserId}
            usersDictionary={usersDictionary}
            messages={messages}
            unreadMessageDetector={unreadMessageDetector}
            messageIdToSelect={messageIdToSelect} />);
    }

    const dispatch = useDispatch();
    const messagesRef = useRef<HTMLDivElement>(null);

    // Start scroll listener to download more messages when scroll reaches near the top
    useLayoutEffect(() => {
        const messagesDiv = messagesRef.current;
        if (!messagesDiv || !chatFunctions.isConfirmedChat(chat)) {
            return;
        }

        // Set the scroll top or scroll bottom to maintain the previously saved scroll position
        if (chat.scrollTop !== null) {
            messagesDiv.scrollTop = chat.scrollTop;
        } else if (chat.scrollBottom !== null) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight - messagesDiv.clientHeight - chat.scrollBottom;
        }

        const onScroll = (e: Event) => onScroll_downloadMoreMessages(chat, e.target as HTMLElement);
        messagesDiv.addEventListener("scroll", onScroll);

        onScroll_downloadMoreMessages(chat, messagesDiv);

        return () => messagesDiv.removeEventListener("scroll", onScroll);
    }, [chat, messagesRef.current]);

    const hasUnreadMessages = chatId 
        ? chatFunctions.getUnreadMessageCount(chat) > 0 
        : false;

    // Start a new UnreadMessagesHandler to mark messages as read once they have been visible for a certain duration
    useLayoutEffect(() => {
        if (!chatId || !hasUnreadMessages) {
            return;
        }

        const unreadMessagesHandler = UnreadMessagesHandler.startNew(chatId);
        return () => unreadMessagesHandler.stop();
    }, [chatId, hasUnreadMessages]);

    // If there is a messageToSelect then set the scroll so that the message is in the middle of the screen
    useLayoutEffect(() => {
        if (messageIdToSelect != null) {
            const messagesDiv = messagesRef.current;
            const clientId = chatFunctions.getClientMessageId(messages, messageIdToSelect);
            if (clientId != null && messagesDiv != null) {
                chatFunctions.scrollToMessage(messagesDiv, clientId);
            }
        }
    }, [messageIdToSelect]); 

    // Listen to scroll events and load more messages if the user scrolls near the top of the currently loaded messages
    function onScroll_downloadMoreMessages(chat: ConfirmedChat, messagesDiv: HTMLElement) {
        const minMessageIdOnServer = chatFunctions.getMinMessageIdOnServer(chat);

        const downloadMoreMessages =
            !chat.messagesDownloading.length &&
            chat.minLocalMessageId !== null &&
            chat.minLocalMessageId > minMessageIdOnServer &&
            messagesDiv.scrollTop < 200;

        if (downloadMoreMessages) {
            const fromId = Math.max(chat.minLocalMessageId! - PAGE_SIZE, minMessageIdOnServer);
            const count = chat.minLocalMessageId! - fromId;
            dispatch(getMessages(chat.chatId, fromId, count));
        }
    }

    return (
        <Grid id="messages" ref={messagesRef} item flex="1 1" className={classes.container}>
            <div className={classes.messagesList}>
                {children}
            </div>
            <ScrollToBottomButton parentElem={messagesRef} className={classes.scrollToBottomButton} />
        </Grid>
    );
}
