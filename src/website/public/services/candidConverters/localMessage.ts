import { LocalMessage } from "../../model/messages";
import { toDate as timestampToDate } from "../candidConverters/timestamp";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(value: any) : LocalMessage {
    return {
        kind: "local",
        id: value.id,
        date: timestampToDate(value.timestamp),
        sender: userIdFromCandid(value.sender),
        text: value.text
    };
}