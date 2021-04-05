import { Timestamp } from "../../domain/model/common";

export function toDate(value: bigint) : Date {
    return new Date(Number(value));
}

export function fromCandid(value: bigint) : Timestamp {
    return Number(value);
}

export function toCandid(timestamp: Timestamp) : bigint {
    return BigInt(timestamp);
}
