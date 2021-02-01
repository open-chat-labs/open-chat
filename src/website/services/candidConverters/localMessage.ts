import { LocalMessage } from "../../model/messages";
import { fromCandid as messageContentFromCandid } from "./messageContent";
import { toDate as timestampToDate } from "./timestamp";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(value: any) : LocalMessage {
    return {
        kind: "local",
        id: value.id,
        key: value.id,
        date: timestampToDate(value.timestamp),
        sender: userIdFromCandid(value.sender),
        content: messageContentFromCandid(value.content)
    };
}
