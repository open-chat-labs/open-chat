import { ApiOptionUpdate, OptionUpdate, UnsupportedValueError } from "openchat-shared";

// takes a type of the form [] | [A] and a mapper from A -> B and returns a B or undefined
export function optional<A, B>(candid: [] | [A], mapper: (a: A) => B): B | undefined {
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

export function apiOptionUpdate<A, B>(
    mapper: (a: A) => B,
    domain: OptionUpdate<A>
): ApiOptionUpdate<B> {
    if (domain === undefined) return { NoChange: null };
    if (domain === "set_to_none") return { SetToNone: null };
    return { SetToSome: mapper(domain.value) };
}

export function applyOptionUpdate<T>(
    original: T | undefined,
    update: OptionUpdate<T>
): T | undefined {
    if (update === undefined) return original;
    if (update === "set_to_none") return undefined;
    return update.value;
}

export function mapOptionUpdate<A, B>(original: OptionUpdate<A>, mapper: (a: A) => B): OptionUpdate<B> {
    if (original === undefined || original === "set_to_none") return original;
    return { value: mapper(original.value) };
}

export function identity<T>(x: T): T {
    return x;
}

// todo - this maps *any* response to void and should only be used temporarily
export function toVoid(_x: unknown): void {
    return;
}

// Convert a hex string to a byte array
export function hexStringToBytes(hex: string): Uint8Array {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return new Uint8Array(bytes);
}

export function consolidateBytes(bytes: Uint8Array | number[]): Uint8Array {
    return Array.isArray(bytes)
        ? new Uint8Array(bytes)
        : bytes;
}

// Convert a byte array to a hex string
export function bytesToHexString(bytes: Uint8Array | number[]): string {
    return consolidateBytes(bytes).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}
