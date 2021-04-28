import { Option } from "../../domain/model/common";
import { LocalMessage, ReplyContext } from "../../domain/model/messages";
import { fromCandid as messageContentFromCandid } from "./messageContent";
import { fromCandid as optionFromCandid } from "./option";
import { toDate as timestampToDate } from "./timestamp";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(value: any) : LocalMessage {
    return {
        kind: "local",
        id: value.id,
        clientMessageId: value.client_message_id,
        date: timestampToDate(value.timestamp),
        sender: userIdFromCandid(value.sender),
        content: messageContentFromCandid(value.content),
        repliesTo: replyContextFromCandid(value.replies_to)
    };
}

function replyContextFromCandid(value: any) : Option<ReplyContext> {
    const option = optionFromCandid<any>(value);
    return option
        ? {
            chatId: option.chat_id,
            userId: userIdFromCandid(option.user_id),
            messageId: option.message_id,
            content: messageContentFromCandid(option.content)
        }
        : null;
}
