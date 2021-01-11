import { Timestamp } from "../model/common";

export function getCurrent() : Timestamp {
    return Date.now();
}

export function asDate(timestamp: Timestamp) : Date {
    return new Date(timestamp);
}
