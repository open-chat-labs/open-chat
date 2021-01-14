import { Option } from "./common";
import { LocalMessage, Message, RemoteMessage, UnconfirmedMessage } from "./messages";
import { UserId } from "./users";
import * as setFunctions from "../utils/setFunctions";
import { CONFIRMED_DIRECT_CHAT, CONFIRMED_GROUP_CHAT } from "../constants";

export type Chat = ConfirmedChat | UnconfirmedChat;
export type ConfirmedChat = ConfirmedDirectChat | ConfirmedGroupChat;
export type UnconfirmedChat = UnconfirmedDirectChat | UnconfirmedGroupChat;

export type ChatId = BigInt;

type ConfirmedChatCommon = {
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
    kind: "cd",
    them: UserId
}

export type ConfirmedGroupChat = ConfirmedChatCommon & {
    kind: "cg",
    subject: string,
    participants: UserId[]
}

type UnconfirmedChatCommon = {
    messages: UnconfirmedMessage[];
}

export type UnconfirmedDirectChat = UnconfirmedChatCommon & {
    kind: "ud",
    them: UserId
}

export type UnconfirmedGroupChat = UnconfirmedChatCommon & {
    kind: "ug",
    id: Symbol,
    subject: string,
    participants: UserId[]
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
        minimumUnconfirmedMessageIndex: 0
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
        minimumUnconfirmedMessageIndex: 0
    };
}

export const addMessage = (chat: ConfirmedChat, message: LocalMessage) : void => {
    addMessages(chat, [message]);
}

export const addMessages = (chat: ConfirmedChat, messages: LocalMessage[]) : void => {
    // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
    messages.sort((a, b) => a.id - b.id);

    extendMessagesRangeDownTo(chat, messages[0].id);
    extendMessagesRangeUpTo(chat, messages[messages.length - 1].id);

    for (const message of messages) {
        setFunctions.remove(chat.messagesToDownload, message.id);

        const messageIndex = getMessageIndex(chat.messages, message.id);
        const currentMessage = chat.messages[messageIndex];
        if (currentMessage.kind === "local") {
            // If the current message is 'local' then this message has already been added
            continue;
        }
        chat.messages[messageIndex] = message;

        removeMatchingUnconfirmedMessage(chat, message.text);

        if (chat.updatedDate < message.date) {
            chat.updatedDate = message.date;
        }
    }

    queueMissingMessagesForDownload(chat);
}

export const addUnconfirmedMessage = (chat: Chat, message: string) : void => {
    chat.messages.push({
        kind: "unconfirmed",
        text: message
    } as UnconfirmedMessage);
}

export const queueMissingMessagesForDownload = (chat: ConfirmedChat) : void => {
    const missingMessages = chat.messages.filter(m => m.kind === "remote").map(m => (m as RemoteMessage).id);
    setFunctions.unionWith(chat.messagesToDownload, missingMessages);
}

export const extendMessagesRangeDownTo = (chat: ConfirmedChat, messageId: number) : void => {
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
    }
    chat.earliestConfirmedMessageId = messageId;
}

export const extendMessagesRangeUpTo = (chat: ConfirmedChat, messageId: number) : void => {
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
    }
    chat.latestConfirmedMessageId = messageId;
}

const removeMatchingUnconfirmedMessage = (chat: ConfirmedChat, text: string) : boolean => {
    let indexOfMatch: number = -1;
    for (let index = chat.minimumUnconfirmedMessageIndex; index < chat.messages.length; index++) {
        const message = chat.messages[index];
        if (message.kind !== "unconfirmed") {
            chat.minimumUnconfirmedMessageIndex = index;
        } else if (message.text === text) {
            indexOfMatch = index;
            chat.messages.splice(indexOfMatch, 1);
            return true;
        }
    }
    return false;
}

const calculateEarliestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    return messages.length && messages[0].kind !== "unconfirmed"
        ? messages[0].id
        : null;
}

const calculateLatestConfirmedMessageId = (messages: Message[]) : Option<number> => {
    for (const message of messages) {
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
