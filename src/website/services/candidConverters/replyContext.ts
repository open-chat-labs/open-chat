import { Option } from "../../domain/model/common";
import { ReplyContext } from "../../domain/model/messages";
import { fromCandid as messageContentFromCandid, toCandid as messageContentToCandid } from "./messageContent";
import { fromCandid as optionFromCandid, toCandid as optionToCandid } from "./option";
import { fromCandid as userIdFromCandid, toCandid as userIdToCandid } from "./userId";

export function fromCandid(value: any) : Option<ReplyContext> {
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

export function toCandid(repliesTo: Option<ReplyContext>) : any {
    const option = repliesTo
        ? {
            chat_id: repliesTo.chatId,
            user_id: userIdToCandid(repliesTo.userId),
            message_id: repliesTo.messageId,
            content: messageContentToCandid(repliesTo.content)
        }
        : null;

    return optionToCandid(option);
}
