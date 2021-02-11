import { ConfirmedChat, ConfirmedDirectChat, ConfirmedGroupChat } from "../../domain/model/chats";
import * as chatFunctions from "../../domain/model/chats";
import { fromCandid as chatIdFromCandid } from "./chatId";
import { fromCandid as localMessageFromCandid } from "./localMessage";
import { toArray as rangeSetToArray } from "./rangeSet";
import { toDate as timestampToDate } from "./timestamp";
import { fromCandid as userIdFromCandid } from "./userId";

export function chatFromCandid(value: any) : ConfirmedChat {
    if (value.hasOwnProperty("Direct")) {
        return directChatFromCandid(value.Direct);
    } else if (value.hasOwnProperty("Group")) {
        return groupChatFromCandid(value.Group);
    } else {
        throw new Error("Unable to convert value to Chat");
    }
}

export function directChatFromCandid(value: any) : ConfirmedDirectChat {
    return chatFunctions.newConfirmedDirectChat(
        chatIdFromCandid(value.id),
        userIdFromCandid(value.them),
        timestampToDate(value.display_date),
        timestampToDate(value.last_updated),
        value.latest_messages.reverse().map(localMessageFromCandid),
        rangeSetToArray(value.unread_by_me_message_id_ranges),
        rangeSetToArray(value.unread_by_them_message_id_ranges));
}

export function groupChatFromCandid(value: any) : ConfirmedGroupChat {
    return chatFunctions.newConfirmedGroupChat(
        chatIdFromCandid(value.id),
        value.subject,
        value.participants.map(userIdFromCandid),
        timestampToDate(value.display_date),
        timestampToDate(value.last_updated),
        value.latest_messages.reverse().map(localMessageFromCandid),
        rangeSetToArray(value.unread_by_me_message_id_ranges),
        rangeSetToArray(value.unread_by_any_message_id_ranges));
}
