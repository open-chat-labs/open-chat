import BigNumber from "bignumber.js";

export function fromCandid(value: BigNumber) : Date {
    return new Date(Number(value));
}
