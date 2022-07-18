import type { ApiOptionUpdate, OptionUpdate } from "../domain/optionUpdate";
import { UnsupportedValueError } from "./error";

// takes a type of the form [] | [A] and a mapper from A -> B and returns a B or undefined
export function optional<A, B>(candid: [] | [A], mapper: (a: A) => B): B | undefined {
    if (candid === []) {
        return undefined;
    }
    return candid[0] !== undefined ? mapper(candid[0]) : undefined;
}

export function optionUpdate<A, B>(
    candid: ApiOptionUpdate<A>,
    mapper: (a: A) => B
): OptionUpdate<B> {
    if ("NoChange" in candid) return undefined;
    if ("SetToNone" in candid) return "set_to_none";
    if ("SetToSome" in candid) return { value: mapper(candid.SetToSome) };
    throw new UnsupportedValueError("Unexpected ApiOptionUpdate type returned", candid);
}

export function applyOptionUpdate<T>(
    original: T | undefined,
    update: OptionUpdate<T>
): T | undefined {
    if (update === undefined) return original;
    if (update === "set_to_none") return undefined;
    return update.value;
}

export function identity<T>(x: T): T {
    return x;
}

// todo - this maps *any* response to void and should only be used temporarily
export function toVoid(_x: unknown): void {
    return;
}

// Convert a hex string to a byte array
export function hexStringToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// Convert a byte array to a hex string
export function bytesToHexString(bytes: number[]): string {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}
