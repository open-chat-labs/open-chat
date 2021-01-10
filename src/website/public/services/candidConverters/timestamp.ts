import BigNumber from "bignumber.js";

import { Timestamp } from "../../model/common";

export function fromCandid(value: BigNumber) : Timestamp {
    return Number(value);
}
