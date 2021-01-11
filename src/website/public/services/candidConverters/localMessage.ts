import { LocalMessage } from "../../model/messages";
import { fromCandid as dateFromCandid } from "./date";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(value: any) : LocalMessage {
    return {
        kind: "local",
        id: value.id,
        date: dateFromCandid(value.timestamp),
        sender: userIdFromCandid(value.sender),
        text: value.text
    };
}