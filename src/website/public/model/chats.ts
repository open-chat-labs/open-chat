import { Option } from "./common";
import { LocalMessage, Message, RemoteMessage, UnconfirmedMessage } from "./messages";
import { UserId } from "./users";
import * as setFunctions from "../utils/setFunctions";

export type Chat = ConfirmedChat | UnconfirmedChat;
export type ConfirmedChat = DirectChat | GroupChat;
export type UnconfirmedChat = NewDirectChat | NewGroupChat;

export type ChatId = BigInt;

abstract class ConfirmedChatBase {
    chatId: ChatId;
    updatedDate: Date;
    readUpTo: number;
    messages: Message[];
    messagesToDownload: number[];
    messagesDownloading: number[];
    earliestConfirmedMessageId: number;
    latestConfirmedMessageId: number;
    minimumUnconfirmedMessageIndex: number;

    protected constructor(
        chatId: ChatId,
        updatedDate: Date,
        readUpTo: number,
        messages: Message[],
        messagesToDownload: number[] = [],
        messagesDownloading: number[] = [],
        earliestConfirmedMessageId: number = 0,
        latestConfirmedMessageId: number = 0,
        minimumUnconfirmedMessageIndex: number = 0) {
        this.chatId = chatId;
        this.updatedDate = updatedDate;
        this.readUpTo = readUpTo;
        this.messages = messages;
        this.messagesToDownload = messagesToDownload;
        this.messagesDownloading = messagesDownloading;
        this.earliestConfirmedMessageId = earliestConfirmedMessageId ? earliestConfirmedMessageId : this.calculateEarliestConfirmedMessageId();
        this.latestConfirmedMessageId = latestConfirmedMessageId ? latestConfirmedMessageId : this.calculateLatestConfirmedMessageId();
        this.minimumUnconfirmedMessageIndex = minimumUnconfirmedMessageIndex;
    }

    abstract clone() : ConfirmedChat;

    addMessage = (message: LocalMessage) : void => {
        this.addMessages([message]);
    }

    addMessages = (messages: LocalMessage[]) : void => {
        // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
        messages.sort((a, b) => a.id - b.id);

        this.extendMessagesRangeDownTo(messages[0].id);
        this.extendMessagesRangeUpTo(messages[messages.length - 1].id);

        for (let message of messages) {
            setFunctions.remove(this.messagesToDownload, message.id);

            const messageIndex = this.getMessageIndex(message.id);
            const currentMessage = this.messages[messageIndex];
            if (currentMessage.kind === "local") {
                // If the current message is 'local' then this message has already been added
                continue;
            }
            this.messages[messageIndex] = message;

            this.removeMatchingUnconfirmedMessage(message.text);

            if (this.updatedDate < message.date) {
                this.updatedDate = message.date;
            }
        }

        this.queueMissingMessagesForDownload();
    }

    addUnconfirmedMessage = (message: string) : void => {
        this.messages.push({
            kind: "unconfirmed",
            text: message
        } as UnconfirmedMessage);
    }

    queueMissingMessagesForDownload = () : void => {
        const missingMessages = this.messages.filter(m => m.kind === "remote").map(m => (m as RemoteMessage).id);
        setFunctions.unionWith(this.messagesToDownload, missingMessages);
    }

    extendMessagesRangeDownTo = (messageId: number) : void => {
        if (!this.earliestConfirmedMessageId) {
            this.messages.splice(0, 0, { kind: "remote", id: messageId });
            this.latestConfirmedMessageId = messageId;
        } else if (messageId >= this.earliestConfirmedMessageId) {
            return;
        } else {
            const toPrepend: RemoteMessage[] = [];
            for (let id = messageId; id < this.earliestConfirmedMessageId; id++) {
                toPrepend.push({kind: "remote", id});
            }
            this.messages.splice(0, 0, ...toPrepend);
        }
        this.earliestConfirmedMessageId = messageId;
    }

    extendMessagesRangeUpTo = (messageId: number) : void => {
        if (!this.latestConfirmedMessageId) {
            this.messages.splice(0, 0, { kind: "remote", id: messageId });
            this.earliestConfirmedMessageId = messageId;
        } else if (messageId <= this.latestConfirmedMessageId) {
            return;
        } else {
            const toAdd: RemoteMessage[] = [];
            for (let id = this.latestConfirmedMessageId + 1; id <= messageId; id++) {
                toAdd.push({ kind: "remote", id });
            }
            this.messages.splice(this.getMessageIndex(this.latestConfirmedMessageId + 1), 0, ...toAdd);
        }
        this.latestConfirmedMessageId = messageId;
    }

    private removeMatchingUnconfirmedMessage = (text: string) : boolean => {
        let indexOfMatch: number = -1;
        for (let index = this.minimumUnconfirmedMessageIndex; index < this.messages.length; index++) {
            const message = this.messages[index];
            if (message.kind !== "unconfirmed") {
                this.minimumUnconfirmedMessageIndex = index;
            } else if (message.text === text) {
                indexOfMatch = index;
                this.messages.splice(indexOfMatch, 1);
                return true;
            }
        }
        return false;
    }

    private calculateEarliestConfirmedMessageId = () : number => {
        return this.messages.length && this.messages[0].kind !== "unconfirmed"
            ? this.messages[0].id
            : 0;
    }

    private calculateLatestConfirmedMessageId = () : number => {
        for (let index = this.messages.length - 1; index >= 0; index--) {
            const message = this.messages[index];
            if (message.kind !== "unconfirmed") {
                return message.id;
            }
        }
        return 0;
    }

    private getMessageIndex = (messageId: number) : number => {
        const lowestMessageId = this.messages.length && this.messages[0].kind !== "unconfirmed"
            ? this.messages[0].id
            : messageId;

        return messageId - lowestMessageId;
    }
}

export class DirectChat extends ConfirmedChatBase {
    them: UserId;

    constructor(
        chatId: ChatId,
        them: UserId,
        updatedDate: Date,
        readUpTo: number = 0,
        messages: Message[] = [],
        messagesToDownload: number[] = [],
        messagesDownloading: number[] = [],
        earliestConfirmedMessageId: number = 0,
        latestConfirmedMessageId: number = 0,
        minimumUnconfirmedMessageIndex: number = 0) {
        super(chatId, updatedDate, readUpTo, messages, messagesToDownload, messagesDownloading,
            earliestConfirmedMessageId, latestConfirmedMessageId, minimumUnconfirmedMessageIndex);
        this.them = them;
    }

    clone() : DirectChat {
        return new DirectChat(
            this.chatId,
            this.them,
            this.updatedDate,
            this.readUpTo,
            this.messages,
            this.messagesToDownload,
            this.messagesDownloading,
            this.earliestConfirmedMessageId,
            this.latestConfirmedMessageId,
            this.minimumUnconfirmedMessageIndex);
    }
}

export class GroupChat extends ConfirmedChatBase {
    subject: string;
    participants: UserId[];

    constructor(
        chatId: ChatId,
        subject: string,
        participants: UserId[],
        updatedDate: Date,
        readUpTo: number = 0,
        messages: Message[] = [],
        messagesToDownload: number[] = [],
        messagesDownloading: number[] = [],
        earliestConfirmedMessageId: number = 0,
        latestConfirmedMessageId: number = 0,
        minimumUnconfirmedMessageIndex: number = 0) {
        super(chatId, updatedDate, readUpTo, messages, messagesToDownload, messagesDownloading,
            earliestConfirmedMessageId, latestConfirmedMessageId, minimumUnconfirmedMessageIndex);
        this.subject = subject;
        this.participants = participants;
    }

    clone() : GroupChat {
        return new GroupChat(
            this.chatId,
            this.subject,
            this.participants,
            this.updatedDate,
            this.readUpTo,
            this.messages,
            this.messagesToDownload,
            this.messagesDownloading,
            this.earliestConfirmedMessageId,
            this.latestConfirmedMessageId,
            this.minimumUnconfirmedMessageIndex);
    }
}

abstract class UnconfirmedChatBase {
    messages: UnconfirmedMessage[];

    protected constructor(messages: UnconfirmedMessage[]) {
        this.messages = messages;
    }

    abstract clone() : UnconfirmedChat;

    addUnconfirmedMessage = (message: string) => {
        this.messages.push({
            kind: "unconfirmed",
            text: message
        } as UnconfirmedMessage);
    }
}

export class NewDirectChat extends UnconfirmedChatBase {
    them: UserId;

    constructor(them: UserId, messages: UnconfirmedMessage[] = []) {
        super(messages);
        this.them = them;
    }

    clone(): NewDirectChat {
        return new NewDirectChat(this.them, this.messages);
    }
}

export class NewGroupChat extends UnconfirmedChatBase {
    id: Symbol;
    subject: string;
    participants: UserId[];

    constructor(id: Symbol, subject: string, participants: UserId[], messages: UnconfirmedMessage[] = []) {
        super(messages);
        this.id = id;
        this.subject = subject;
        this.participants = participants;
    }

    clone(): NewGroupChat {
        return new NewGroupChat(this.id, this.subject, this.participants, this.messages);
    }
}
