import { ConfirmedMessage, RemoteMessage, UnconfirmedMessage } from "./messages";
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
    latestKnownMessageId: number;
    confirmedMessages: ConfirmedMessage[];
    unconfirmedMessages: UnconfirmedMessage[];
    messagesToDownload: number[];
    messagesDownloading: number[];

    protected constructor(
        chatId: ChatId,
        updatedDate: Date,
        readUpTo: number,
        latestKnownMessageId: number,
        confirmedMessages: ConfirmedMessage[],
        unconfirmedMessages: UnconfirmedMessage[]) {
        this.chatId = chatId;
        this.updatedDate = updatedDate;
        this.readUpTo = readUpTo;
        this.latestKnownMessageId = latestKnownMessageId;
        this.confirmedMessages = confirmedMessages;
        this.unconfirmedMessages = unconfirmedMessages;
        this.messagesToDownload = [];
        this.messagesDownloading = [];
    }

    abstract clone() : ConfirmedChat;

    addMessage(message: ConfirmedMessage) {
        this.addMessages([message]);
    }

    addMessages(messages: ConfirmedMessage[], latestKnownMessageId?: number) : void {
        // Ensure messages are sorted by id (they should be already so this should only do a single iteration)
        messages.sort((a, b) => a.id - b.id);

        const chat = this;
        const lowestCurrentMessageId = chat.confirmedMessages.length ? chat.confirmedMessages[0].id : null;
        const lowestNewMessageId = messages[0].id;

        if (chat.messagesToDownload.length) {
            messages
                .filter(m => m.kind === "local")
                .forEach(m => setFunctions.remove(chat.messagesToDownload, m.id));
        }

        let indexWhereNoLongerPrepending = 0;
        if (lowestCurrentMessageId && lowestNewMessageId < lowestCurrentMessageId) {
            // If we reach here, then we need to prepend at least 1 message to the current array
            const shiftRequired = lowestCurrentMessageId - lowestNewMessageId;
            const toPrepend: ConfirmedMessage[] = [];
            for (let i = 0; i < messages.length && messages[i].id < lowestCurrentMessageId; i++) {
                const message = messages[i];
                toPrepend[message.id - lowestCurrentMessageId + shiftRequired] = message;
                indexWhereNoLongerPrepending++;
            }

            // Check for gaps in the array of messages, if found, plug them with RemoteMessages and queue them for download
            for (let id = lowestNewMessageId + 1; id < lowestCurrentMessageId; id++) {
                const index = id - lowestNewMessageId;
                if (!messages[index]) {
                    chat.confirmedMessages[index] = {
                        kind: "remote",
                        id: id
                    } as RemoteMessage;

                    setFunctions.add(chat.messagesToDownload, id);
                }
            }

            chat.confirmedMessages.unshift(...toPrepend);
        }

        const lowestMessageId = lowestCurrentMessageId
            ? Math.min(lowestCurrentMessageId, lowestNewMessageId)
            : lowestNewMessageId;

        // Now handle the later messages
        for (let index = indexWhereNoLongerPrepending; index < messages.length; index++) {
            const message = messages[index];
            const messageIndex = message.id - lowestMessageId;

            if (messageIndex < chat.confirmedMessages.length) {
                // This is the only case where we overwrite an existing message, so first check if the existing message is
                // 'local'. If it is we would be replacing it with a message that is the same or worse, so we do nothing.
                if (chat.confirmedMessages[messageIndex].kind !== "local") {
                    chat.confirmedMessages[messageIndex] = message;
                }
            } else if (messageIndex === chat.confirmedMessages.length) {
                chat.confirmedMessages.push(message);
            } else {
                // If we reach here then some messages are missing so we need to fill the gaps with RemoteMessages and mark
                // them to be downloaded
                const firstMissingMessageId = chat.confirmedMessages[chat.confirmedMessages.length - 1].id + 1;
                const lastMissingMessageId = message.id - 1;
                const indexToInsertAt = chat.confirmedMessages.length;
                addMissingMessages(firstMissingMessageId, lastMissingMessageId, indexToInsertAt);
                chat.confirmedMessages.push(message);
            }

            if (message.kind === "local") {
                if (chat.updatedDate < message.date) {
                    chat.updatedDate = message.date;
                }
            }

            if (chat.latestKnownMessageId < message.id) {
                chat.latestKnownMessageId = message.id;
            }
        }

        // If after adding these messages the latestKnownMessageId value we have is still lower than what we got from the
        // server then we need to add some missing messages and mark them to be downloaded.
        if (latestKnownMessageId && chat.latestKnownMessageId < latestKnownMessageId) {
            addMissingMessages(chat.latestKnownMessageId + 1, latestKnownMessageId, chat.latestKnownMessageId + 1);
            chat.latestKnownMessageId = latestKnownMessageId;
        }

        function addMissingMessages(fromId: number, toId: number, index: number) {
            const missingMessages: RemoteMessage[] = [];
            for (let id = fromId; id <= toId; id++) {
                missingMessages.push({ kind: "remote", id });
                setFunctions.add(chat.messagesToDownload, id);
            }

            chat.confirmedMessages.splice(index, 0, ...missingMessages);
        }
    }
}

export class DirectChat extends ConfirmedChatBase {
    them: UserId;

    constructor(
        chatId: ChatId,
        them: UserId,
        updatedDate: Date,
        readUpTo: number = 0,
        latestKnownMessageId: number = 0,
        confirmedMessages: ConfirmedMessage[] = [],
        unconfirmedMessages: UnconfirmedMessage[] = []) {
        super(chatId, updatedDate, readUpTo, latestKnownMessageId, confirmedMessages, unconfirmedMessages);
        this.them = them;
    }

    clone() : DirectChat {
        return new DirectChat(
            this.chatId,
            this.them,
            this.updatedDate,
            this.readUpTo,
            this.latestKnownMessageId,
            this.confirmedMessages,
            this.unconfirmedMessages);
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
        latestKnownMessageId: number = 0,
        confirmedMessages: ConfirmedMessage[] = [],
        unconfirmedMessages: UnconfirmedMessage[] = []) {
        super(chatId, updatedDate, readUpTo, latestKnownMessageId, confirmedMessages, unconfirmedMessages);
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
            this.latestKnownMessageId,
            this.confirmedMessages,
            this.unconfirmedMessages);
    }
}

abstract class UnconfirmedChatBase {
    unconfirmedMessages: UnconfirmedMessage[];

    protected constructor(unconfirmedMessages: UnconfirmedMessage[]) {
        this.unconfirmedMessages = unconfirmedMessages;
    }

    abstract clone() : UnconfirmedChat;
}

export class NewDirectChat extends UnconfirmedChatBase {
    them: UserId;

    constructor(them: UserId, unconfirmedMessages: UnconfirmedMessage[] = []) {
        super(unconfirmedMessages);
        this.them = them;
    }

    clone(): NewDirectChat {
        return new NewDirectChat(this.them, this.unconfirmedMessages);
    }
}

export class NewGroupChat extends UnconfirmedChatBase {
    id: Symbol;
    subject: string;
    participants: UserId[];

    constructor(id: Symbol, subject: string, participants: UserId[], unconfirmedMessages: UnconfirmedMessage[] = []) {
        super(unconfirmedMessages);
        this.id = id;
        this.subject = subject;
        this.participants = participants;
    }

    clone(): NewGroupChat {
        return new NewGroupChat(this.id, this.subject, this.participants, this.unconfirmedMessages);
    }
}
