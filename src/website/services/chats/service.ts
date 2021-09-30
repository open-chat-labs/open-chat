import { ChatId } from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import { UserId } from "../../domain/model/users";
import createGroupChat, { CreateGroupChatResponse } from "./createGroupChat";
import sendDirectMessage, { SendDirectMessageResponse } from "./sendDirectMessage";
import sendMessage, { SendMessageResponse } from "./sendMessage";
import markRead, { MarkReadResponse } from "./markRead";
import addParticipants, { AddParticipantsResponse } from "./addParticipants";
import removeParticipant, { RemoveParticipantResponse } from "./removeParticipant";
import getUpdates, { GetUpdatesRequest, GetUpdatesResponse } from "./getUpdates";
import getMessages, { getMessagesById, GetMessagesResponse } from "./getMessages";
import searchAllMessages, { SearchAllMessagesResponse } from "./searchAllMessages";
import leaveGroup, { LeaveGroupResult } from "./leaveGroup";
import joinGroup, { JoinGroupResult } from "./joinGroup";
import blockUser from "./blockUser";
import toggle_notifications from "./toggleNotifications";

export default class service {
    public static createGroupChat(chatId: ChatId, subject: string, users: UserId[], chatHistoryVisibleToNewJoiners: boolean) : Promise<CreateGroupChatResponse> {
        return createGroupChat(chatId, subject, users, chatHistoryVisibleToNewJoiners);
    }

    public static sendDirectMessage(userId: UserId, senderName: Option<string>, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendDirectMessageResponse> {
        return sendDirectMessage(userId, senderName, clientMessageId, content, repliesTo);
    }

    public static sendMessage(chatId: ChatId, senderName: Option<string>, clientMessageId: string, content: MessageContent, repliesTo: Option<ReplyContext>) : Promise<SendMessageResponse> {
        return sendMessage(chatId, senderName, clientMessageId, content, repliesTo);
    }

    public static markRead(chatId: ChatId, fromId: number, toId: number) : Promise<MarkReadResponse> {
        return markRead(chatId, fromId, toId);
    }

    public static addParticipants(chatId: ChatId, users: UserId[]) : Promise<AddParticipantsResponse> {
        return addParticipants(chatId, users);
    }

    public static removeParticipant(chatId: ChatId, userId: UserId) : Promise<RemoveParticipantResponse> {
        return removeParticipant(chatId, userId);
    }

    public static leaveGroup(chatId: ChatId) : Promise<LeaveGroupResult> {
        return leaveGroup(chatId);
    }

    public static joinGroup(chatId: ChatId) : Promise<JoinGroupResult> {
        return joinGroup(chatId);
    }

    public static blockUser(userId: UserId, unblock: boolean) : Promise<void> {
        return blockUser(userId, unblock);
    }

    public static getUpdates(request: GetUpdatesRequest) : Promise<GetUpdatesResponse> {
        return getUpdates(request);
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

    public static toggle_notifications(chatId: ChatId, mute: boolean) : Promise<void> {
        return toggle_notifications(chatId, mute);
    }
}

