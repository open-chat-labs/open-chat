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
    #earliestConfirmedMessageId: Option<number>;
    #latestConfirmedMessageId: Option<number>;
    #minimumUnconfirmedMessageIndex: number;

    protected constructor(
        chatId: ChatId,
        updatedDate: Date,
        readUpTo: number,
        messages: Message[]) {
        this.chatId = chatId;
        this.updatedDate = updatedDate;
        this.readUpTo = readUpTo;
        this.messages = messages;
        this.messagesToDownload = [];
        this.messagesDownloading = [];
        this.#earliestConfirmedMessageId = this.calculateEarliestConfirmedMessageId();
        this.#latestConfirmedMessageId = this.calculateLatestConfirmedMessageId();
        this.#minimumUnconfirmedMessageIndex = 0;
    }

    abstract clone() : ConfirmedChat;

    addMessage = (message: LocalMessage) : void => {
        this.addMessages([message]);
    }

    addMessages = (messages: LocalMessage[]) : void => {
        // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
        messages.sort((a, b) => a.id - b.id);

        // These 2 setters will ensure the messages array covers the full range of ids from the new messages
        this.earliestConfirmedMessageId = messages[0].id;
        this.latestConfirmedMessageId = messages[messages.length - 1].id;

        for (let index = 0; index < messages.length; index++) {
            const message = messages[index];
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

    get earliestConfirmedMessageId() : number {
        return this.#earliestConfirmedMessageId ?? 0;
    }

    set earliestConfirmedMessageId(value: number) {
        if (!this.#earliestConfirmedMessageId) {
            this.messages.splice(0, 0, { kind: "remote", id: value });
            this.#latestConfirmedMessageId = value;
        } else if (value >= this.#earliestConfirmedMessageId) {
            return;
        } else {
            const toPrepend: RemoteMessage[] = [];
            for (let id = value; id < this.#earliestConfirmedMessageId; id++) {
                toPrepend.push({kind: "remote", id});
            }
            this.messages.splice(0, 0, ...toPrepend);
        }
        this.#earliestConfirmedMessageId = value;
    }

    get latestConfirmedMessageId() : number {
        return this.#latestConfirmedMessageId ?? 0;
    }

    set latestConfirmedMessageId(value: number) {
        if (!this.#latestConfirmedMessageId) {
            this.messages.splice(0, 0, { kind: "remote", id: value });
            this.#earliestConfirmedMessageId = value;
        } else if (value <= this.#latestConfirmedMessageId) {
            return;
        } else {
            const toAdd: RemoteMessage[] = [];
            for (let id = this.#latestConfirmedMessageId + 1; id <= value; id++) {
                toAdd.push({ kind: "remote", id });
            }
            this.messages.splice(this.getMessageIndex(this.#latestConfirmedMessageId + 1), 0, ...toAdd);
        }
        this.#latestConfirmedMessageId = value;
    }

    removeMatchingUnconfirmedMessage(text: string) {
        let indexOfMatch: number = -1;
        for (let index = this.#minimumUnconfirmedMessageIndex; index < this.messages.length; index++) {
            const message = this.messages[index];
            if (message.kind !== "unconfirmed") {
                this.#minimumUnconfirmedMessageIndex = index;
            } else if (message.text === text) {
                indexOfMatch = index;
                break;
            }
        }

        if (indexOfMatch >= 0) {
            this.messages.splice(indexOfMatch, 1);
        }
    }

    queueMissingMessagesForDownload = () : void => {
        const missingMessages = this.messages.filter(m => m.kind === "remote").map(m => (m as RemoteMessage).id);
        setFunctions.unionWith(this.messagesToDownload, missingMessages);
    }

    calculateEarliestConfirmedMessageId = () : Option<number> => {
        return this.messages.length && this.messages[0].kind !== "unconfirmed"
            ? this.messages[0].id
            : null;
    }

    calculateLatestConfirmedMessageId = () : Option<number> => {
        for (let index = this.messages.length - 1; index >= 0; index--) {
            const message = this.messages[index];
            if (message.kind !== "unconfirmed") {
                return message.id;
            }
        }
        return null;
    }

    calculateLowestUnconfirmedExpectedMessageId = (startingFromId: number) : Option<number> => {
        const startingIndex = Math.max(this.getMessageIndex(startingFromId), 0);
        for (let index = startingIndex; index < this.messages.length; index++) {
            const message = this.messages[index];
            if (message.kind === "unconfirmed") {
                return this.getMessageIdFromIndex(index);
            }
        }
        return null;
    }

    getMessageIndex = (messageId: number) : number => {
        const lowestMessageId = this.messages.length && this.messages[0].kind !== "unconfirmed"
            ? this.messages[0].id
            : messageId;

        return messageId - lowestMessageId;
    }

    getMessageIdFromIndex = (index: number) : number => {
        if (!this.#earliestConfirmedMessageId) {
            return 0;
        }
        return this.#earliestConfirmedMessageId + index;
    }
}

export class DirectChat extends ConfirmedChatBase {
    them: UserId;

    constructor(
        chatId: ChatId,
        them: UserId,
        updatedDate: Date,
        readUpTo: number = 0,
        messages: Message[] = []) {
        super(chatId, updatedDate, readUpTo, messages);
        this.them = them;
    }

    clone() : DirectChat {
        return new DirectChat(
            this.chatId,
            this.them,
            this.updatedDate,
            this.readUpTo,
            this.messages);
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
        messages: Message[] = []) {
        super(chatId, updatedDate, readUpTo, messages);
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
            this.messages);
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
