import { Option } from "./common";
import { UserId } from "./users";
import * as setFunctions from "../../utils/setFunctions";
import MarkAsReadHandler from "../MarkAsReadHandler";
import {
    LocalMessage,
    Message,
    MessageContent,
    P2PMessage,
    RemoteMessage,
    ReplyContext,
    UnconfirmedMessage
} from "./messages";
import {
    CONFIRMED_DIRECT_CHAT,
    CONFIRMED_GROUP_CHAT,
    DEFAULT_UPDATED_DATE,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../../constants";

export type Chat = ConfirmedChat | UnconfirmedChat;
export type GroupChat = ConfirmedGroupChat | UnconfirmedGroupChat;
export type DirectChat = ConfirmedDirectChat | UnconfirmedDirectChat;
export type ConfirmedChat = ConfirmedDirectChat | ConfirmedGroupChat;
export type UnconfirmedChat = UnconfirmedDirectChat | UnconfirmedGroupChat;

export type ChatId = bigint;

export function generateChatId() : ChatId {
    const array = new Uint32Array(4);

    window.crypto.getRandomValues(array);

    let chatId = BigInt(array[0]);
    chatId += BigInt(array[1]) << BigInt(32);
    chatId += BigInt(array[2]) << BigInt(64);
    chatId += BigInt(array[3]) << BigInt(96);

    return chatId;
}

type ChatCommon = {
    chatId: ChatId,
    scrollTop: Option<number>,
    scrollBottom: Option<number>,
    draftMessage: string,
    replyContext: Option<ReplyContext>
}

type ConfirmedChatCommon = ChatCommon & {
    displayDate: Date,
    lastUpdated: Date,
    messages: Message[],
    messagesToDownload: number[],
    messagesDownloading: number[],
    minLocalMessageId: Option<number>,
    maxLocalMessageId: Option<number>,
    minimumUnconfirmedMessageIndex: number,

    // If the messageId is known, add to unreadMessageIds, otherwise add to unreadClientMessageIds, never add to both
    unreadMessageIds: number[],
    unreadClientMessageIds: string[],

    // If the messageId is known, add to markAsReadPending, otherwise add to markAsReadByClientIdPending, never add to both
    markAsReadPending: number[],
    markAsReadByClientIdPending: string[],

    messageToSelect: Option<number>
}

export type ConfirmedDirectChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_DIRECT_CHAT,
    them: UserId,
    themTyping: boolean,
    unreadByThemMessageIds: number[],
    markAsReadByThemPendingSync: number[],
    markAsReadByThemByClientIdPendingSync: string[],
    muted: boolean,
}

export type ConfirmedGroupChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_GROUP_CHAT,
    subject: string,
    minMessageIdOnServer: number,
    participants: UserId[],
    participantsTyping: UserId[],
    unreadByAnyMessageIds: number[]
    muted: boolean,
}

type UnconfirmedChatCommon = ChatCommon & {
    messages: UnconfirmedMessage[]
}

export type UnconfirmedDirectChat = UnconfirmedChatCommon & {
    kind: typeof UNCONFIRMED_DIRECT_CHAT,
    them: UserId
}

export type UnconfirmedGroupChat = UnconfirmedChatCommon & {
    kind: typeof UNCONFIRMED_GROUP_CHAT,
    subject: string,
    initialParticipants: UserId[]
}

export const isDirectChat = (chat: Chat) : chat is DirectChat => {
    return chat.kind === CONFIRMED_DIRECT_CHAT || chat.kind === UNCONFIRMED_DIRECT_CHAT;
}

export const isGroupChat = (chat: Chat) : chat is GroupChat => {
    return chat.kind === CONFIRMED_GROUP_CHAT || chat.kind === UNCONFIRMED_GROUP_CHAT;
}

export const isConfirmedChat = (chat: Chat) : chat is ConfirmedChat => {
    return chat.kind === CONFIRMED_DIRECT_CHAT || chat.kind === CONFIRMED_GROUP_CHAT;
}

export const getUnreadMessageCount = (chat: Chat) : number => {
    return isConfirmedChat(chat)
        ? chat.unreadMessageIds.length + chat.unreadClientMessageIds.length - chat.markAsReadPending.length - chat.markAsReadByClientIdPending.length
        : 0;
}

export const getUnreadChatCount = (chats: Chat[]) : number => {
    let count = 0;
    for (const chat of chats) {
        if (getUnreadMessageCount(chat)) {
            count++;
        }
    }
    return count;
}

export const newConfirmedDirectChat = (
    chatId: ChatId, them: UserId, displayDate: Date, lastUpdated: Date, messages: Message[] = [],
    unreadMessageIds: number[] = [], unreadByThemMessageIds: number[] = [], muted: boolean = false) : ConfirmedDirectChat => {

    const earliestConfirmedMessageId = getMinMessageId(messages);
    const latestConfirmedMessageId = getMaxMessageId(messages);

    return {
        kind: CONFIRMED_DIRECT_CHAT,
        chatId,
        them,
        displayDate,
        lastUpdated,
        unreadMessageIds,
        unreadClientMessageIds: [],
        markAsReadPending: [],
        markAsReadByClientIdPending: [],
        unreadByThemMessageIds,
        markAsReadByThemPendingSync: [],
        markAsReadByThemByClientIdPendingSync: [],
        messages,
        messagesToDownload: [],
        messagesDownloading: [],
        minLocalMessageId: earliestConfirmedMessageId,
        maxLocalMessageId: latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        themTyping: false,
        replyContext: null,
        messageToSelect: null,
        muted,
    };
}

export const newConfirmedGroupChat = (
    chatId: ChatId, subject: string, participants: UserId[], displayDate: Date, lastUpdated: Date, minMessageIdOnServer: number,
    messages: Message[] = [], unreadMessageIds: number[] = [], unreadByAnyMessageIds: number[] = [], muted: boolean = false) : ConfirmedGroupChat => {

    const earliestConfirmedMessageId = getMinMessageId(messages);
    const latestConfirmedMessageId = getMaxMessageId(messages);

    return {
        kind: CONFIRMED_GROUP_CHAT,
        chatId,
        subject,
        participants,
        displayDate,
        lastUpdated,
        minMessageIdOnServer,
        unreadMessageIds,
        unreadClientMessageIds: [],
        markAsReadPending: [],
        markAsReadByClientIdPending: [],
        unreadByAnyMessageIds,
        messages,
        messagesToDownload: [],
        messagesDownloading: [],
        minLocalMessageId: earliestConfirmedMessageId,
        maxLocalMessageId: latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        participantsTyping: [],
        replyContext: null,
        messageToSelect: null,
        muted,
    };
}

export const newUnconfirmedDirectChat = (userId: UserId, chatId: ChatId) : UnconfirmedDirectChat => {
    return {
        kind: UNCONFIRMED_DIRECT_CHAT,
        chatId,
        them: userId,
        messages: [],
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        replyContext: null
    };
}

export const newUnconfirmedGroupChat = (chatId: ChatId, subject: string, users: UserId[]) : UnconfirmedGroupChat => {
    return {
        kind: UNCONFIRMED_GROUP_CHAT,
        chatId,
        subject,
        initialParticipants: users,
        messages: [],
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        replyContext: null
    };
}

export const mergeUpdates = (currentChat: Exclude<Chat, UnconfirmedGroupChat>, updatedChat: ConfirmedChat, isSelectedChat: boolean) : ConfirmedChat => {
    // These messages have just come from the server so are all of type LocalMessage
    const messages = updatedChat.messages as LocalMessage[];
    const chat = currentChat.kind === UNCONFIRMED_DIRECT_CHAT
        ? confirmDirectChat(currentChat, updatedChat.chatId)
        : currentChat;

    addMessages(chat, messages, isSelectedChat);

    if (updatedChat.lastUpdated > chat.lastUpdated) {
        chat.lastUpdated = updatedChat.lastUpdated;
        chat.displayDate = updatedChat.displayDate;
        chat.unreadMessageIds = updatedChat.unreadMessageIds;
        if (isDirectChat(chat)) {
            chat.unreadByThemMessageIds = (updatedChat as ConfirmedDirectChat).unreadByThemMessageIds;
        } else {
            chat.unreadByAnyMessageIds = (updatedChat as ConfirmedGroupChat).unreadByAnyMessageIds;
        }
    }
    return chat;
}

export const confirmDirectChat = (chat: UnconfirmedDirectChat, chatId: ChatId) : ConfirmedDirectChat => {
    return newConfirmedDirectChat(
        chatId,
        chat.them,
        DEFAULT_UPDATED_DATE,
        DEFAULT_UPDATED_DATE,
        chat.messages);
}

export const addMessage = (chat: ConfirmedChat, message: LocalMessage, isSelectedChat: boolean) : void => {
    addMessages(chat, [message], isSelectedChat);
}

export const addMessages = (chat: ConfirmedChat, messages: LocalMessage[], isSelectedChat: boolean) : void => {

    if (messages.length === 0)
        return;

    // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
    messages.sort((a, b) => a.id - b.id);

    extendMessagesRangeDownTo(chat, messages[0].id, isSelectedChat);
    extendMessagesRangeUpTo(chat, messages[messages.length - 1].id, isSelectedChat);

    for (const message of messages) {
        setFunctions.remove(chat.messagesToDownload, message.id);

        const messageIndex = getMessageIndex(chat.messages, message.id);
        const currentMessage = chat.messages[messageIndex];
        if (currentMessage.kind === "local") {
            // If the current message is 'local' then this message has already been added
            continue;
        }
        chat.messages[messageIndex] = message;

        const unconfirmedMessage = removeMatchingUnconfirmedMessage(chat, message.clientMessageId);
        if (unconfirmedMessage) {
            // If we are confirming the message then we know the content hasn't changed so we keep the old
            // reference to avoid re-renders in particular for media messages
            message.content = unconfirmedMessage.content;
        }
        
        if (setFunctions.remove(chat.unreadClientMessageIds, message.clientMessageId)) {
            setFunctions.add(chat.unreadMessageIds, message.id);

            // We only add to markAsReadByClientIdPending if we don't yet know the messageId, so if this incoming message
            // matches one in the pending queue, now that we know the messageId we can mark it as read on the server
            if (setFunctions.remove(chat.markAsReadByClientIdPending, message.clientMessageId)) {
                setFunctions.add(chat.markAsReadPending, message.id);
                MarkAsReadHandler.markRead(chat.chatId, [message.id]);
            }
        }

        if (chat.displayDate < message.date) {
            chat.displayDate = message.date;
        }
    }

    queueMissingMessagesForDownload(chat);
}

export const addUnconfirmedMessage = (chat: Chat, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : void => {
    const message: UnconfirmedMessage = {
        kind: "unconfirmed",
        clientMessageId,
        date: new Date(),
        content,
        repliesTo
    };
    chat.messages.push(message);
    chat.scrollBottom = 0;
    chat.scrollTop = null;
}

export const addP2PMessage = (chat: ConfirmedChat, message: P2PMessage) : void => {
    chat.messages.push(message);
    chat.unreadClientMessageIds.push(message.clientMessageId);
    chat.displayDate = message.date;
}

export const queueMissingMessagesForDownload = (chat: ConfirmedChat) : void => {
    const missingMessages = chat.messages.filter(m => m.kind === "remote").map(m => (m as RemoteMessage).id);
    setFunctions.unionWith(chat.messagesToDownload, missingMessages);
}

export const extendMessagesRangeDownTo = (chat: ConfirmedChat, messageId: number, isSelectedChat: boolean) : void => {
    if (!chat.minLocalMessageId) {
        chat.messages.splice(0, 0, { kind: "remote", id: messageId });
        chat.maxLocalMessageId = messageId;
    } else if (messageId >= chat.minLocalMessageId) {
        return;
    } else {
        const toPrepend: RemoteMessage[] = [];
        for (let id = messageId; id < chat.minLocalMessageId; id++) {
            toPrepend.push({kind: "remote", id});
        }
        chat.messages.splice(0, 0, ...toPrepend);
        if (isSelectedChat) {
            maintainScrollBottom(chat);
        }
    }
    chat.minLocalMessageId = messageId;
}

export const extendMessagesRangeUpTo = (chat: ConfirmedChat, messageId: number, isSelectedChat: boolean) : void => {
    if (!chat.maxLocalMessageId) {
        chat.messages.splice(0, 0, { kind: "remote", id: messageId });
        chat.minLocalMessageId = messageId;
    } else if (messageId <= chat.maxLocalMessageId) {
        return;
    } else {
        const toAdd: RemoteMessage[] = [];
        for (let id = chat.maxLocalMessageId + 1; id <= messageId; id++) {
            toAdd.push({ kind: "remote", id });
        }
        chat.messages.splice(getMessageIndex(chat.messages, chat.maxLocalMessageId + 1), 0, ...toAdd);
        if (isSelectedChat) {
            maintainScroll(chat);
        }
    }
    chat.maxLocalMessageId = messageId;
}

export const getChat = (chats: Chat[], chatId: ChatId) : [Chat, number] => {
    return tryFindChat(chats, { chatId }) as [Chat, number];
}

// Only call this if you know that the chat is already a confirmed chat
export const getConfirmedChat = (chats: Chat[], chatId: ChatId) : [ConfirmedChat, number] => {
    return tryFindChat(chats, { chatId }) as [ConfirmedChat, number];
}

export const tryGetChat = (chats: Chat[], chatId: ChatId) : [Option<ConfirmedChat>, number] => {
    return tryFindChat(chats, { chatId }) as [Option<ConfirmedChat>, number];
}

export const getChatByUserId = (chats: Chat[], userId: UserId) : [DirectChat, number] => {
    return tryFindChat(chats, { userId }) as [DirectChat, number];
}

export const tryFindChat = (chats: Chat[], filter: ChatFilter) : [Option<Chat>, number] => {
    let index: number = -1;
    if (index === -1 && filter.chatId) {
        index = findChatIndex(chats, filter.chatId);
    }
    if (index === -1 && filter.userId) {
        index = findDirectChatIndex(chats, filter.userId);
    }
    if (index === -1) {
        return [null, -1];
    }
    return [chats[index], index];
}

export const removeChat = (chats: Chat[], chatId: ChatId) => {
    const index = chats.findIndex(c => chatId === c.chatId);
    if (index >= 0) {
        chats.splice(index, 1);
    }
}

export type ChatFilter = {
    chatId?: ChatId,
    userId?: UserId
}

export const sortChatsAndReturnSelectedIndex = (chats: Chat[], selectedIndex: Option<number>) => {
    const selectedChat = selectedIndex !== null ? chats[selectedIndex] : null;
    chats.sort((a, b) => {
        if ("displayDate" in a) {
            if ("displayDate" in b) {
                // If both are confirmed then compare the display dates
                return b.displayDate.getTime() - a.displayDate.getTime();
            }
            // If only 'a' is confirmed, then 'b' should appear first
            return 1;
        }

        // If only 'b' is confirmed, then 'a' should appear first
        if ("displayDate" in b) {
            return -1;
        }

        // If neither are confirmed then treat them equally (this should be extremely rare)
        return 0;
    });
    return selectedChat !== null ? chats.indexOf(selectedChat) : null;
}

export const findChatIndex = (chats: Chat[], chatId: ChatId) : number => {
    return chats.findIndex(c => chatId === c.chatId);
}

export const findDirectChatIndex = (chats: Chat[], userId: UserId) : number => {
    return chats.findIndex(c => "them" in c && userId === c.them);
}

export const maintainScroll = (chat: Chat) : void => {
    if (isScrolledToBottom()) {
        maintainScrollBottom(chat);
    } else {
        maintainScrollTop(chat);
    }
}

export const maintainScrollTop = (chat: Chat) : void => {
    const scrollValues = getScrollTopAndBottom();
    if (scrollValues) {
        chat.scrollTop = scrollValues[0];
        chat.scrollBottom = null;
    }
}

export const maintainScrollBottom = (chat: Chat) : void => {
    const scrollValues = getScrollTopAndBottom();
    if (scrollValues) {
        chat.scrollBottom = scrollValues[1];
        chat.scrollTop = null;
    }
}

export const saveDraftMessage = (chat: Chat) => {
    const textbox = document.getElementById("textbox");
    if (!textbox) return;
    chat.draftMessage = textbox.innerHTML;
}

export const restoreDraftMessage = (chat: Chat) => {
    const textbox = document.getElementById("textbox");
    if (!textbox) return;
    textbox.innerHTML = chat.draftMessage;
}

export const getUsers = (chat: Chat) : UserId[] => {
    if (isDirectChat(chat)) {
        return [chat.them];
    }
    if (isConfirmedChat(chat)) {
        return chat.participants;
    }
    return chat.initialParticipants;
}

export const markMessagesAsReadLocally = (chat: ConfirmedChat, messageIds: number[]) : void => {
    setFunctions.unionWith(chat.markAsReadPending, messageIds);
    MarkAsReadHandler.markRead(chat.chatId, messageIds);
}

export const markMessagesAsReadByClientIdLocally = (chat: ConfirmedChat, clientMessageIds: string[]) : void => {
    setFunctions.unionWith(chat.markAsReadByClientIdPending, clientMessageIds);
}

export const markMessagesAsReadRemotely = (chat: ConfirmedDirectChat, messageIds: number[]) : void => {
    setFunctions.unionWith(chat.markAsReadByThemPendingSync, messageIds);
}

export const markMessagesAsReadByClientIdRemotely = (chat: ConfirmedDirectChat, clientMessageIds: string[]) : void => {
    setFunctions.unionWith(chat.markAsReadByThemByClientIdPendingSync, clientMessageIds);
}

export const markMessagesAsReadOnServer = (chat: ConfirmedChat, fromId: number, toId: number) : void => {
    for (let messageId = fromId; messageId <= toId; messageId++) {
        const clientMessageId = getClientMessageId(chat.messages, messageId);
        setFunctions.remove(chat.unreadMessageIds, messageId);
        setFunctions.remove(chat.markAsReadPending, messageId);
        setFunctions.remove(chat.unreadClientMessageIds, clientMessageId);
        setFunctions.remove(chat.markAsReadByClientIdPending, clientMessageId);
    }
}

export const getMinMessageId = (messages: Message[]) : Option<number> => {
    return messages.length && messages[0].kind !== "unconfirmed" && messages[0].kind !== "p2p"
        ? messages[0].id
        : null;
}

export const getMaxMessageId = (messages: Message[]) : Option<number> => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.kind !== "unconfirmed" && message.kind !== "p2p") {
            return message.id;
        }
    }
    return null;
}

export const getMinMessageIdOnServer = (chat: ConfirmedChat) : number => {
    return isGroupChat(chat) ? chat.minMessageIdOnServer : 1;
}

export const tryFindMessge = (messages: Message[], messageId: number): Option<Message> => {
    const index = getMessageIndex(messages, messageId);
    return messages[index];
}

export const freeMediaData = (chat: Chat) => {
    if (!isConfirmedChat(chat))
        return;

    const blobUrlsToRevoke: string[] = [];

    for (const message of chat.messages) {
        if (message.kind !== "remote" && message.content.kind === "media" && message.content.blobUrl) {
            blobUrlsToRevoke.push(message.content.blobUrl);
            message.content.blobUrl = null;
        }
    }

    // Make sure this happens after current reduce/render loop otherwise there can be a race 
    // where a video player can still try to load more data from blob
    setTimeout(() => {
        for (const blobUrl of blobUrlsToRevoke) {
            URL.revokeObjectURL(blobUrl);
        }
    }, 100);
}

export const getScrollTopAndBottom = () : Option<[number, number]> => {
    const messagesDiv = document.getElementById("messages");
    if (!messagesDiv) {
        return null;
    }
    return [messagesDiv.scrollTop, messagesDiv.scrollHeight - messagesDiv.clientHeight - messagesDiv.scrollTop];
}

export const scrollToMessage = (containerDiv: HTMLDivElement, clientMessageId: string) => {
    const messageDiv = document.getElementById(clientMessageId);
    if (!messageDiv) {
        return;
    }
    const targetScroll = Math.max(0, messageDiv.offsetTop - (containerDiv.clientHeight - messageDiv.clientHeight) / 2);
    containerDiv.scrollTo({ top: targetScroll });
}

export const getClientMessageId = (messages: Message[], messageId: number) : string => {
    const index = getMessageIndex(messages, messageId);
    const message = messages[index];
    return message.kind === "remote" ? "" : message.clientMessageId;
}

const removeMatchingUnconfirmedMessage = (chat: ConfirmedChat, clientMessageId: string) : Option<UnconfirmedMessage | P2PMessage> => {
    let indexOfMatch: number = -1;
    for (let index = chat.minimumUnconfirmedMessageIndex; index < chat.messages.length; index++) {
        const message = chat.messages[index];
        if (message.kind !== "unconfirmed" && message.kind != "p2p") {
            chat.minimumUnconfirmedMessageIndex = index;
        } else if (message.clientMessageId === clientMessageId) {
            indexOfMatch = index;
            chat.messages.splice(indexOfMatch, 1);
            return message;
        }
    }
    return null;
}

const getMessageIndex = (messages: Message[], messageId: number) : number => {
    const lowestMessageId = messages.length && messages[0].kind !== "unconfirmed" && messages[0].kind !== "p2p"
        ? messages[0].id
        : messageId;

    return messageId - lowestMessageId;
}

const isScrolledToBottom = () : boolean => {
    const scrollValues = getScrollTopAndBottom();
    return !scrollValues || scrollValues[1] <= 20;
}
