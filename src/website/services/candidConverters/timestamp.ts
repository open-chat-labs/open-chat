import BigNumber from "bignumber.js";

import { Timestamp } from "../../domain/model/common";

export function toDate(value: BigNumber) : Date {
    return new Date(Number(value));
}

export function fromCandid(value: BigNumber) : Timestamp {
    return Number(value);
}

export function toCandid(timestamp: Timestamp) : BigNumber {
    return new BigNumber(timestamp);
}
