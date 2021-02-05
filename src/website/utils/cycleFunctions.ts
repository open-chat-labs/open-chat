import { Currency } from "../model/common";

const GBP_TO_MILLION_CYCLES = 810_000;
const MILLION = 1_000_000;
const MILLION_BIGINT = BigInt(MILLION);

export function toCurrency(amount: bigint, currency: Currency) : number {
    if (currency != "GBP") {
        throw Error("Unsupported currency");
    }

    return Number(amount / MILLION_BIGINT) / GBP_TO_MILLION_CYCLES;
}

export function fromCurrency(amount: number, currency: Currency) : bigint {    
    if (currency != "GBP") {
        throw Error("Unsupported currency");
    }

    return BigInt(amount * GBP_TO_MILLION_CYCLES) * MILLION_BIGINT;
}

export function toT(val: bigint) : number {
    return Number(val / MILLION_BIGINT) / MILLION;
}

export function fromT(val: number) : bigint {
    return BigInt(val * MILLION) * MILLION_BIGINT;
}