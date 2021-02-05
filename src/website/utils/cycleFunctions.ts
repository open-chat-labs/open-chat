import { Currency } from "../model/common";

const GBP_TO_BILLION_CYCLES = 810;
const BILLION = BigInt(1_000_000_000);

export function toCurrency(amount: bigint, currency: Currency) : number {
    if (currency != "GBP") {
        throw Error("Unsupported currency");
    }

    return Number(amount / BILLION) / GBP_TO_BILLION_CYCLES;
}

export function fromCurrency(amount: number, currency: Currency) : bigint {    
    if (currency != "GBP") {
        throw Error("Unsupported currency");
    }

    return BigInt(amount * GBP_TO_BILLION_CYCLES) * BILLION;
}

export function toT(val: bigint) : number {
    return Number(val / BILLION) / 1000;
}

export function fromT(val: number) : bigint {
    return BigInt(val * 1000) * BILLION;
}