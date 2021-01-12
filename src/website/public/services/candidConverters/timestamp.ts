import BigNumber from "bignumber.js";

import { Timestamp } from "../../model/common";

export function toDate(value: BigNumber) : Date {
    return new Date(Number(value));
}

export function fromCandid(value: BigNumber) : Timestamp {
    return BigInt(value);
}

export function toCandid(timestamp: Timestamp) : BigNumber {
    return new BigNumber(timestamp.toString());
}
