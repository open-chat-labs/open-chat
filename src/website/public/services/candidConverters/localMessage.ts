import { LocalMessage } from "../../model/messages";
import { fromCandid as timestampFromCandid } from "./timestamp";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(value: any) : LocalMessage {
    return {
        kind: "local",
        id: value.id,
        timestamp: timestampFromCandid(value.timestamp),
        sender: userIdFromCandid(value.sender),
        text: value.text
    };
}