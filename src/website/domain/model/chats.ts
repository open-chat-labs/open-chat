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

export type ChatId = BigInt;

type ChatCommon = {
    scrollTop: Option<number>,
    scrollBottom: Option<number>,
    draftMessage: string,
}

type ConfirmedChatCommon = ChatCommon & {
    chatId: ChatId,
    displayDate: Date,
    lastUpdated: Date,
    messages: Message[],
    messagesToDownload: number[],
    messagesDownloading: number[],
    earliestConfirmedMessageId: Option<number>,
    latestConfirmedMessageId: Option<number>,
    minimumUnconfirmedMessageIndex: number,

    // If the messageId is known, add to unreadMessageIds, otherwise add to unreadClientMessageIds, never add to both
    unreadMessageIds: number[],
    unreadClientMessageIds: string[],

    // If the messageId is known, add to markAsReadPending, otherwise add to markAsReadByClientIdPending, never add to both
    markAsReadPending: number[],
    markAsReadByClientIdPending: string[]
}

export type ConfirmedDirectChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_DIRECT_CHAT,
    them: UserId,
    themTyping: boolean,
    unreadByThemMessageIds: number[],
    markAsReadByThemPendingSync: number[],
    markAsReadByThemByClientIdPendingSync: string[]
}

export type ConfirmedGroupChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_GROUP_CHAT,
    subject: string,
    participants: UserId[],
    participantsTyping: UserId[],
    unreadByAnyMessageIds: number[]
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
    id: Symbol,
    subject: string,
    initialParticipants: UserId[],
    pendingParticipants: UserId[]
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
    unreadMessageIds: number[] = [], unreadByThemMessageIds: number[] = []) : ConfirmedDirectChat => {

    const earliestConfirmedMessageId = calculateEarliestConfirmedMessageId(messages);
    const latestConfirmedMessageId = calculateLatestConfirmedMessageId(messages);

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
        earliestConfirmedMessageId,
        latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        themTyping: false
    };
}

export const newConfirmedGroupChat = (
    chatId: ChatId, subject: string, participants: UserId[], displayDate: Date, lastUpdated: Date, messages: Message[] = [],
    unreadMessageIds: number[] = [], unreadByAnyMessageIds: number[] = []) : ConfirmedGroupChat => {

    const earliestConfirmedMessageId = calculateEarliestConfirmedMessageId(messages);
    const latestConfirmedMessageId = calculateLatestConfirmedMessageId(messages);

    return {
        kind: CONFIRMED_GROUP_CHAT,
        chatId,
        subject,
        participants,
        displayDate,
        lastUpdated,
        unreadMessageIds,
        unreadClientMessageIds: [],
        markAsReadPending: [],
        markAsReadByClientIdPending: [],
        unreadByAnyMessageIds,
        messages,
        messagesToDownload: [],
        messagesDownloading: [],
        earliestConfirmedMessageId,
        latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: "",
        participantsTyping: []
    };
}

export const newUnconfirmedDirectChat = (userId: UserId) : UnconfirmedDirectChat => {
    return {
        kind: UNCONFIRMED_DIRECT_CHAT,
        them: userId,
        messages: [],
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: ""
    };
}

export const newUnconfirmedGroupChat = (tempId: Symbol, subject: string, users: UserId[]) : UnconfirmedGroupChat => {
    return {
        kind: UNCONFIRMED_GROUP_CHAT,
        id: tempId,
        subject,
        initialParticipants: users,
        pendingParticipants: [],
        messages: [],
        scrollTop: null,
        scrollBottom: 0,
        draftMessage: ""
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

        removeMatchingUnconfirmedMessage(chat, message.clientMessageId);

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

export const addUnconfirmedMessage = (chat: Chat, clientMessageId: string, content: MessageContent) : void => {
    const message: UnconfirmedMessage = {
        kind: "unconfirmed",
        clientMessageId,
        date: new Date(),
        content
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
    if (!chat.earliestConfirmedMessageId) {
        chat.messages.splice(0, 0, { kind: "remote", id: messageId });
        chat.latestConfirmedMessageId = messageId;
    } else if (messageId >= chat.earliestConfirmedMessageId) {
        return;
    } else {
        const toPrepend: RemoteMessage[] = [];
        for (let id = messageId; id < chat.earliestConfirmedMessageId; id++) {
            toPrepend.push({kind: "remote", id});
        }
        chat.messages.splice(0, 0, ...toPrepend);
        if (isSelectedChat) {
            maintainScrollBottom(chat);
        }
    }
    chat.earliestConfirmedMessageId = messageId;
}

export const extendMessagesRangeUpTo = (chat: ConfirmedChat, messageId: number, isSelectedChat: boolean) : void => {
    if (!chat.latestConfirmedMessageId) {
        chat.messages.splice(0, 0, { kind: "remote", id: messageId });
        chat.earliestConfirmedMessageId = messageId;
    } else if (messageId <= chat.latestConfirmedMessageId) {
        return;
    } else {
        const toAdd: RemoteMessage[] = [];
        for (let id = chat.latestConfirmedMessageId + 1; id <= messageId; id++) {
            toAdd.push({ kind: "remote", id });
        }
        chat.messages.splice(getMessageIndex(chat.messages, chat.latestConfirmedMessageId + 1), 0, ...toAdd);
        if (isSelectedChat) {
            maintainScroll(chat);
        }
    }
    chat.latestConfirmedMessageId = messageId;
}

export const getChat = (chats: Chat[], old_chat: Chat): [Chat, number] => {
    const filter = {
        chatId: ("chatId" in old_chat && old_chat.chatId) ? old_chat.chatId : undefined,
        userId: "them" in old_chat ? old_chat.them : undefined,
        unconfirmedChatId: old_chat.kind === UNCONFIRMED_GROUP_CHAT ? old_chat.id : undefined
    };
    return tryFindChat(chats, filter) as [Chat, number];
}

export const findChat = (chats: Chat[], filter: ChatFilter) : [Chat, number] => {
    return tryFindChat(chats, filter) as [Chat, number];
}

export const getChatById = (chats: Chat[], chatId: ChatId) : [ConfirmedChat, number] => {
    return tryFindChat(chats, { chatId }) as [ConfirmedChat, number];
}

export const tryGetChatById = (chats: Chat[], chatId: ChatId) : [Option<ConfirmedChat>, number] => {
    return tryFindChat(chats, { chatId }) as [Option<ConfirmedChat>, number];
}

export const getChatByUserId = (chats: Chat[], userId: UserId) : [DirectChat, number] => {
    return tryFindChat(chats, { userId }) as [DirectChat, number];
}

export const tryFindChat = (chats: Chat[], filter: ChatFilter) : [Option<Chat>, number] => {
    let index: number = -1;
    if (filter.index != null) {
        index = filter.index;
    }
    if (index === -1 && filter.chatId) {
        index = findChatIndex(chats, filter.chatId);
    }
    if (index === -1 && filter.unconfirmedChatId) {
        index = findChatIndexBySymbol(chats, filter.unconfirmedChatId);
    }
    if (index === -1 && filter.userId) {
        index = findDirectChatIndex(chats, filter.userId);
    }
    if (index === -1) {
        return [null, -1];
    }
    return [chats[index], index];
}

export type ChatFilter = {
    index?: number,
    chatId?: ChatId,
    unconfirmedChatId?: Symbol,
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
    return selectedChat !== null ? chats.indexOf(selectedChat) : 0;
}

export const findChatIndex = (chats: Chat[], chatId: ChatId) : number => {
    return chats.findIndex(c => "chatId" in c && c.chatId && chatId === c.chatId);
}

export const findChatIndexBySymbol = (chats: Chat[], unconfirmedChatId: Symbol) : number => {
    return chats.findIndex(c => c.kind === UNCONFIRMED_GROUP_CHAT && c.id && unconfirmedChatId == c.id);
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
    return chat.initialParticipants.concat(chat.pendingParticipants);
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

const removeMatchingUnconfirmedMessage = (chat: ConfirmedChat, clientMessageId: string) : boolean => {
    let indexOfMatch: number = -1;
    for (let index = chat.minimumUnconfirmedMessageIndex; index < chat.messages.length; index++) {
        const message = chat.messages[index];
        if (message.kind !== "unconfirmed" && message.kind != "p2p") {
            chat.minimumUnconfirmedMessageIndex = index;
        } else if (message.clientMessageId === clientMessageId) {
            indexOfMatch = index;
            chat.messages.splice(indexOfMatch, 1);
            return true;
        }
    }
    return false;
}

const calculateEarliestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    return messages.length && messages[0].kind !== "unconfirmed" && messages[0].kind !== "p2p"
        ? messages[0].id
        : null;
}

const calculateLatestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.kind !== "unconfirmed" && message.kind !== "p2p") {
            return message.id;
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

const getClientMessageId = (messages: Message[], messageId: number) : string => {
    const index = getMessageIndex(messages, messageId);
    const message = messages[index];
    return message.kind === "remote" ? "" : message.clientMessageId;
}

const isScrolledToBottom = () : boolean => {
    const scrollValues = getScrollTopAndBottom();
    return !scrollValues || scrollValues[1] <= 20;
}

const getScrollTopAndBottom = () : Option<[number, number]> => {
    const messagesDiv = document.getElementById("messages");
    if (!messagesDiv) {
        return null;
    }
    return [messagesDiv.scrollTop, messagesDiv.scrollHeight - messagesDiv.clientHeight - messagesDiv.scrollTop];
}
