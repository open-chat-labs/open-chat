import service from "ic:canisters/chats";
import { Chat, ChatId, DirectChat, GroupChat } from "../model/chats";
import { Option, Timestamp } from "../model/common";
import { ConfirmedMessage, Message } from "../model/messages";
import { UserId } from "../model/users";

export default class chatsService {
    public static async createGroupChat(subject: string, users: UserId[]) : Promise<Option<ChatId>> {
        let response: ChatId[] = await service.create_group_chat(subject, users);
        return chatsService.convertToOption(response);
    }

    public static async sendDirectMessage(userId: UserId, message: string) : Promise<SendDirectMessageResult> {
        let response = await service.send_direct_message(userId, message);
        return {
            chatId: response.chat_id,
            messageId: response.message_id,
            timestamp: response.timestamp
        };
    }

    public static async sendMessage(chatId: ChatId, message: string) : Promise<Option<SendMessageResult>> {
        let response: any[] = await service.send_message(chatId, message);
        let asOption = chatsService.convertToOption(response);
        return asOption
            ? { messageId: asOption.message_id, timestamp: asOption.timestamp }
            : null;
    }

    public static async markRead(chatId: ChatId, upToIndex: number) : Promise<Option<number>> {
        let response: number[] = await service.mark_read(chatId, upToIndex);
        return chatsService.convertToOption(response);
    }

    public static async addParticipants(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResult> {
        let response = await service.add_participants(chatId, users);

        if (response.hasOwnProperty("Success")) {
            return {
                kind: "success",
                countAdded: response.Success
            };
        } else if (response.hasOwnProperty("Unauthorized")) {
            return {
                kind: "unauthorized"
            };
        } else if (response.hasOwnProperty("ChatNotFound")) {
            return {
                kind: "chatNotFound"
            };
        } else if (response.hasOwnProperty("NotGroupChat")) {
            return {
                kind: "notGroupChat"
            };
        } else {
            throw new Error("Unrecognised 'add_participants' response");
        }
    }

    public static async removeParticipant(chatId: ChatId, user: UserId) : Promise<RemoveParticipantResult> {
        let response = await service.remove_participant(chatId, user);

        if (response.hasOwnProperty("Success")) {
            return RemoveParticipantResult.Success;
        } else if (response.hasOwnProperty("Unauthorized")) {
            return RemoveParticipantResult.Unauthorized;
        } else if (response.hasOwnProperty("ParticipantNotFound")) {
            return RemoveParticipantResult.ParticipantNotFound;
        } else if (response.hasOwnProperty("CannotRemoveSelfFromChat")) {
            return RemoveParticipantResult.CannotRemoveSelfFromChat;
        } else if (response.hasOwnProperty("ChatNotFound")) {
            return RemoveParticipantResult.ChatNotFound;
        } else if (response.hasOwnProperty("NotGroupChat")) {
            return RemoveParticipantResult.NotGroupChat;
        } else {
            throw new Error("Unrecognised 'remove_participant' response");
        }
    }

    public static async getMessages(chatId: ChatId, fromId: number, pageSize: number) : Promise<Option<GetMessagesResult>> {
        let response: any[] = await service.get_messages(chatId, fromId, pageSize);
        return chatsService.convertGetMessagesResponse(response);
    }

    public static async getDirectMessages(userId: UserId, fromId: number, pageSize: number) : Promise<Option<GetMessagesResult>> {
        let response: any[] = await service.get_direct_messages(userId, fromId, pageSize);
        return chatsService.convertGetMessagesResponse(response);
    }

    public static async listChats(unreadOnly: boolean) : Promise<Chat[]> {
        let response: any[] = await service.list_chats(unreadOnly);
        return response.map(chatsService.convertToChat);
    }

    static convertToChat(value: any) : Chat {
        if (value.hasOwnProperty("Direct")) {
            return chatsService.convertToDirectChat(value.Direct);
        } else if (value.hasOwnProperty("Group")) {
            return chatsService.convertToGroupChat(value.Group);
        } else {
            throw new Error("Unable to convert value to Chat");
        }
    }

    static convertToDirectChat(value: any) : DirectChat {
        let latestMessage = value.latest_message;
        return {
            kind: "direct",
            them: value.them,
            updatedDate: latestMessage.timestamp,
            latestMessageId: latestMessage.id,
            readUpTo: latestMessage.id - value.unread,
            messages: [{ kind: "confirmed", ...latestMessage }]
        }
    }

    static convertToGroupChat(value: any) : GroupChat {
        let messages = [] as Message[];
        let latestMessage : Option<any> = chatsService.convertToOption(value.latest_message);
        if (latestMessage) {
            messages.push(chatsService.convertToConfirmedMessage(latestMessage));
        }

        return {
            kind: "group",
            chatId: value.id,
            subject: value.subject,
            updatedDate: value.updated_date,
            participants: value.participants,
            latestMessageId: value.latest_message.id,
            readUpTo: value.latest_message.id - value.unread,
            messages: messages
        };
    }

    static convertGetMessagesResponse(response: any) : Option<GetMessagesResult> {
        let result: Option<any> = chatsService.convertToOption(response);
        if (result) {
            return {
                messages: result.messages.map(chatsService.convertToConfirmedMessage),
                latestMessageId: result.latest_message_id
            };
        } else {
            return null;
        }
    }

    static convertToOption<T>(value: T[]) : Option<T> {
        return Array.isArray(value) && value.length
            ? value[0]
            : null;
    }

    static convertToConfirmedMessage(value: any) : ConfirmedMessage {
        return { kind: "confirmed", ...value };
    }
}

export type SendDirectMessageResult = {
    chatId: ChatId,
    messageId: number,
    timestamp: Timestamp
}

export type SendMessageResult = {
    messageId: number,
    timestamp: Timestamp
}

export type GetMessagesResult = {
    messages: ConfirmedMessage[],
    latestMessageId: number
}

export type AddParticipantsResult =
    AddParticipantsResult_Success |
    AddParticipantsResult_Unauthorized |
    AddParticipantsResult_ChatNotFound |
    AddParticipantsResult_NotGroupChat;

export type AddParticipantsResult_Success = {
    kind: "success",
    countAdded: number
}

export type AddParticipantsResult_Unauthorized = {
    kind: "unauthorized"
}

export type AddParticipantsResult_ChatNotFound = {
    kind: "chatNotFound"
}

export type AddParticipantsResult_NotGroupChat = {
    kind: "notGroupChat"
}

export enum RemoveParticipantResult {
    Success,
    Unauthorized,
    ParticipantNotFound,
    CannotRemoveSelfFromChat,
    ChatNotFound,
    NotGroupChat
}

