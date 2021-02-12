import { ChatId } from "../../domain/model/chats";
import { MessageContent } from "../../domain/model/messages";
import { UserId } from "../../domain/model/users";
import createGroupChat, { CreateGroupChatResponse } from "./createGroupChat";
import sendDirectMessage, { SendDirectMessageResponse } from "./sendDirectMessage";
import sendMessage, { SendMessageResponse } from "./sendMessage";
import markRead, { MarkReadResponse } from "./markRead";
import addParticipants, { AddParticipantsResponse } from "./addParticipants";
import removeParticipant, { RemoveParticipantResponse } from "./removeParticipant";
import getChats, { GetChatsRequest, GetChatsResponse } from "./getChats";
import getMessages, { getMessagesById, GetMessagesResponse } from "./getMessages";
import searchAllMessages, { SearchAllMessagesResponse } from "./searchAllMessages";

export default class service {
    public static createGroupChat(subject: string, users: UserId[]) : Promise<CreateGroupChatResponse> {
        return createGroupChat(subject, users);
    }

    public static sendDirectMessage(userId: UserId, clientMessageId: string, content: MessageContent) : Promise<SendDirectMessageResponse> {
        return sendDirectMessage(userId, clientMessageId, content);
    }

    public static sendMessage(chatId: ChatId, clientMessageId: string, content: MessageContent) : Promise<SendMessageResponse> {
        return sendMessage(chatId, clientMessageId, content);
    }

    public static markRead(chatId: ChatId, fromId: number, toId: number) : Promise<MarkReadResponse> {
        return markRead(chatId, fromId, toId);
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

    public static searchAllMessages(searchTerm: string, maxResults: number) : Promise<SearchAllMessagesResponse> {
        return searchAllMessages(searchTerm, maxResults);
    }
}

