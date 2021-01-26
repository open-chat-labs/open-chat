import { v1 as uuidv1 } from 'uuid';

import { Option } from "./common";
import { LocalMessage, Message, MessageContent, RemoteMessage, UnconfirmedMessage } from "./messages";
import { UserId } from "./users";
import * as setFunctions from "../utils/setFunctions";
import {
    CONFIRMED_DIRECT_CHAT,
    CONFIRMED_GROUP_CHAT,
    DEFAULT_UPDATED_DATE,
    UNCONFIRMED_DIRECT_CHAT,
    UNCONFIRMED_GROUP_CHAT
} from "../constants";

export type Chat = ConfirmedChat | UnconfirmedChat;
export type GroupChat = ConfirmedGroupChat | UnconfirmedGroupChat;
export type DirectChat = ConfirmedDirectChat | UnconfirmedDirectChat;
export type ConfirmedChat = ConfirmedDirectChat | ConfirmedGroupChat;
export type UnconfirmedChat = UnconfirmedDirectChat | UnconfirmedGroupChat;

export type ChatId = BigInt;

type ChatCommon = {
    scrollTop: Option<number>,
    scrollBottom: Option<number>
}

type ConfirmedChatCommon = ChatCommon & {
    chatId: ChatId,
    updatedDate: Date,
    readUpTo: number,
    messages: Message[],
    messagesToDownload: number[],
    messagesDownloading: number[],
    earliestConfirmedMessageId: Option<number>,
    latestConfirmedMessageId: Option<number>,
    minimumUnconfirmedMessageIndex: number
}

export type ConfirmedDirectChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_DIRECT_CHAT,
    them: UserId
}

export type ConfirmedGroupChat = ConfirmedChatCommon & {
    kind: typeof CONFIRMED_GROUP_CHAT,
    subject: string,
    participants: UserId[]
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

export const newConfirmedDirectChat = (chatId: ChatId, them: UserId, updatedDate: Date, readUpTo: number = 0,
                                       messages: Message[] = []) : ConfirmedDirectChat => {
    const earliestConfirmedMessageId = calculateEarliestConfirmedMessageId(messages);
    const latestConfirmedMessageId = calculateLatestConfirmedMessageId(messages);

    return {
        kind: CONFIRMED_DIRECT_CHAT,
        chatId,
        them,
        updatedDate,
        readUpTo,
        messages,
        messagesToDownload: [],
        messagesDownloading: [],
        earliestConfirmedMessageId,
        latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0
    };
}

export const newConfirmedGroupChat = (chatId: ChatId, subject: string, participants: UserId[], updatedDate: Date,
                                      readUpTo: number = 0, messages: Message[] = []) : ConfirmedGroupChat => {
    const earliestConfirmedMessageId = calculateEarliestConfirmedMessageId(messages);
    const latestConfirmedMessageId = calculateLatestConfirmedMessageId(messages);

    return {
        kind: CONFIRMED_GROUP_CHAT,
        chatId,
        subject,
        participants,
        updatedDate,
        readUpTo,
        messages,
        messagesToDownload: [],
        messagesDownloading: [],
        earliestConfirmedMessageId,
        latestConfirmedMessageId,
        minimumUnconfirmedMessageIndex: 0,
        scrollTop: null,
        scrollBottom: 0
    };
}

export const mergeUpdates = (currentChat: Exclude<Chat, UnconfirmedGroupChat>, updatedChat: ConfirmedChat, isSelectedChat: boolean) : ConfirmedChat => {
    // These messages have just come from the server so are all of type LocalMessage
    const messages = updatedChat.messages as LocalMessage[];
    const chat = currentChat.kind === UNCONFIRMED_DIRECT_CHAT
        ? confirmDirectChat(currentChat, updatedChat.chatId)
        : currentChat;

    addMessages(chat, messages, isSelectedChat);

    return chat;
}

export const confirmDirectChat = (chat: UnconfirmedDirectChat, chatId: ChatId) : ConfirmedDirectChat => {
    return newConfirmedDirectChat(
        chatId,
        chat.them,
        DEFAULT_UPDATED_DATE,
        0,
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

        const unconfirmedMessage = removeMatchingUnconfirmedMessage(chat, message.content);
        if (unconfirmedMessage) {
            message.key = unconfirmedMessage.key;
        }
        if (chat.updatedDate < message.date) {
            chat.updatedDate = message.date;
        }
    }

    queueMissingMessagesForDownload(chat);
}

export const addUnconfirmedMessage = (chat: Chat, content: MessageContent) : void => {
    const message: UnconfirmedMessage = {
        kind: "unconfirmed",
        key: uuidv1().toString(),
        date: new Date(),
        content
    };
    chat.messages.push(message);
    chat.scrollBottom = 0;
    chat.scrollTop = null;
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
        if ("updatedDate" in a) {
            if ("updatedDate" in b) {
                // If both are confirmed then compare the updated dates
                return b.updatedDate.getTime() - a.updatedDate.getTime();
            }
            // If only 'a' is confirmed, then 'b' should appear first
            return 1;
        }

        // If only 'b' is confirmed, then 'a' should appear first
        if ("updatedDate" in b) {
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
    const scrollTop = getScrollTopAndBottom()[0];
    chat.scrollTop = scrollTop;
    chat.scrollBottom = null;
}

export const maintainScrollBottom = (chat: Chat) : void => {
    const scrollBottom = getScrollTopAndBottom()[1];
    chat.scrollBottom = scrollBottom;
    chat.scrollTop = null;
}

const removeMatchingUnconfirmedMessage = (chat: ConfirmedChat, content: MessageContent) : Option<UnconfirmedMessage> => {
    let indexOfMatch: number = -1;
    for (let index = chat.minimumUnconfirmedMessageIndex; index < chat.messages.length; index++) {
        const message = chat.messages[index];
        if (message.kind !== "unconfirmed") {
            chat.minimumUnconfirmedMessageIndex = index;
        } else if (
            (message.content.kind === "text" && content.kind === "text" && message.content.text === content.text) ||
            (message.content.kind === "media" && content.kind === "media" && message.content.id === content.id) ||
            (message.content.kind === "file" && content.kind === "file" && message.content.id === content.id)) {
            indexOfMatch = index;
            chat.messages.splice(indexOfMatch, 1);
            return message;
        }
    }
    return null;
}

const calculateEarliestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    return messages.length && messages[0].kind !== "unconfirmed"
        ? messages[0].id
        : null;
}

const calculateLatestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.kind !== "unconfirmed") {
            return message.id;
        }
    }
    return null;
}

const getMessageIndex = (messages: Message[], messageId: number) : number => {
    const lowestMessageId = messages.length && messages[0].kind !== "unconfirmed"
        ? messages[0].id
        : messageId;

    return messageId - lowestMessageId;
}

const isScrolledToBottom = () : boolean => {
    const scrollBottom = getScrollTopAndBottom()[1];
    return (scrollBottom ?? 0) < 20;
}

const getScrollTopAndBottom = () : [Option<number>, Option<number>] => {
    const messagesDiv = document.getElementById("messages");
    if (!messagesDiv) {
        return [null, null];
    }
    return [messagesDiv.scrollTop, messagesDiv.scrollHeight - messagesDiv.clientHeight - messagesDiv.scrollTop];
}

