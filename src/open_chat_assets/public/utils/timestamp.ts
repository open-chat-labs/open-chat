import { Timestamp } from "../model/common";

export function getCurrent() : Timestamp {
    return Date.now();
}
