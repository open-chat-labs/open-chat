import { ChatId } from "../../model/chats";
import { MessageContent } from "../../model/messages";
import { UserId } from "../../model/users";
import createGroupChat, { CreateGroupChatResponse } from "./createGroupChat";
import sendDirectMessage, { SendDirectMessageResponse } from "./sendDirectMessage";
import sendMessage, { SendMessageResponse } from "./sendMessage";
import markRead, { MarkReadResponse } from "./markRead";
import addParticipants, { AddParticipantsResponse } from "./addParticipants";
import removeParticipant, { RemoveParticipantResponse } from "./removeParticipant";
import getChats, { GetChatsRequest, GetChatsResponse } from "./getChats";
import getMessages, { getMessagesById, GetMessagesResponse } from "./getMessages";

export default class service {
    public static createGroupChat(subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
        return createGroupChat(subject, users);
    }

    public static sendDirectMessage(userId: UserId, content: MessageContent) : Promise<SendDirectMessageResponse> {
        return sendDirectMessage(userId, content);
    }

    public static sendMessage(chatId: ChatId, content: MessageContent) : Promise<SendMessageResponse> {
        return sendMessage(chatId, content);
    }

    public static markRead(chatId: ChatId, upToIndex: number) : Promise<MarkReadResponse> {
        return markRead(chatId, upToIndex);
    }

    public static addParticipants(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
        return addParticipants(chatId, users);
    }

    public static removeParticipant(chatId: ChatId, user: UserId) : Promise<RemoveParticipantResponse> {
        return removeParticipant(chatId, user);
    }

    public static getChats(request: GetChatsRequest) : Promise<GetChatsResponse> {
        return getChats(request);
    }

    public static getMessages(chatId: ChatId, fromId: number, pageSize: number) : Promise<GetMessagesResponse> {
        return getMessages(chatId, fromId, pageSize);
    }

    public static getMessagesById(chatId: ChatId, ids: number[]) : Promise<GetMessagesResponse> {
        return getMessagesById(chatId, ids);
    }
}

