import { ChatId } from "./model/chats";
import { UserId } from "./model/users";

export function userIdsEqual(userId1: UserId, userId2: UserId) : boolean {
    // TODO: Sort this!
    return Boolean(userId1) && Boolean(userId2) && userId1.toString() === userId2.toString();
}

export function chatIdsEqual(chatId1: ChatId, chatId2: ChatId) : boolean {
    // TODO: Sort this!
    return Boolean(chatId1) && Boolean(chatId2) && (chatId1.toString() === chatId2.toString());
}