import {
    type ApiOptionUpdate,
    type ApiOptionUpdateV2,
    type OptionUpdate,
    UnsupportedValueError,
} from "openchat-shared";
import { Principal } from "@dfinity/principal";
import type { ApiPrincipal } from "../services";

// takes a type of the form [] | [A] and a mapper from A -> B and returns a B or undefined
export function optional<A, B>(candid: [] | [A], mapper: (a: A) => B): B | undefined {
    return candid[0] !== undefined ? mapper(candid[0]) : undefined;
}

export function mapOptional<A, B>(input: A | null | undefined, mapper: (a: A) => B): B | undefined {
    return input != null ? mapper(input) : undefined;
}

export function optionUpdate<A, B>(
    candid: ApiOptionUpdate<A>,
    mapper: (a: A) => B,
): OptionUpdate<B> {
    if ("NoChange" in candid) return undefined;
    if ("SetToNone" in candid) return "set_to_none";
    if ("SetToSome" in candid) return { value: mapper(candid.SetToSome) };
    throw new UnsupportedValueError("Unexpected ApiOptionUpdate type returned", candid);
}

export function optionUpdateV2<A, B>(
    value: ApiOptionUpdateV2<A>,
    mapper: (a: A) => B,
): OptionUpdate<B> {
    if (value === "NoChange") return undefined;
    if (value === "SetToNone") return "set_to_none";
    if ("SetToSome" in value) return { value: mapper(value.SetToSome) };
    throw new UnsupportedValueError("Unexpected ApiOptionUpdate type returned", value);
}

export function apiOptionUpdate<A, B>(
    mapper: (a: A) => B,
    domain: OptionUpdate<A>,
): ApiOptionUpdate<B> {
    if (domain === undefined) return { NoChange: null };
    if (domain === "set_to_none") return { SetToNone: null };
    return { SetToSome: mapper(domain.value) };
}

export function apiOptionUpdateV2<A, B>(
    mapper: (a: A) => B,
    domain: OptionUpdate<A>,
): ApiOptionUpdateV2<B> {
    if (domain === undefined) return "NoChange";
    if (domain === "set_to_none") return "SetToNone";
    return { SetToSome: mapper(domain.value) };
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
    return Array.isArray(bytes) ? new Uint8Array(bytes) : bytes;
}

// Convert a byte array to a hex string
export function bytesToHexString(bytes: Uint8Array | number[]): string {
    return consolidateBytes(bytes).reduce(
        (str, byte) => str + byte.toString(16).padStart(2, "0"),
        "",
    );
}

export function principalBytesToString(value: ApiPrincipal): string {
    // When serialized to JSON principals become strings, in all other cases they are serialized as byte arrays
    if (typeof value === "string") {
        return value;
    }
    return Principal.fromUint8Array(consolidateBytes(value)).toString();
}

export function principalStringToBytes(principal: string): Uint8Array {
    return Principal.fromText(principal).toUint8Array();
}

export function maybePrincipalStringToBytes(principal?: string): Uint8Array | undefined {
    if (principal === undefined) return undefined;
    try {
        return principalStringToBytes(principal);
    } catch (err) {
        console.warn("Unable to convert principal string to bytes", principal, err);
    }
    return undefined;
}

export function bigintToBytes(value: bigint): Uint8Array {
    return hexStringToBytes(value.toString(16));
}

export function bytesToBigint(bytes: Uint8Array | number[]): bigint {
    return BigInt("0x" + bytesToHexString(bytes));
}

export function durationToTimestamp(duration: bigint): bigint {
    return BigInt(Date.now() + Number(duration));
}
