import { ChatId } from "../model/chats";

export default function(chatId1: ChatId, chatId2: ChatId) : boolean {
    // TODO: Sort this!
    return Boolean(chatId1 && chatId2 && chatId1.toString() === chatId2.toString());
}