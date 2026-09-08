import { Principal } from "@icp-sdk/core/principal";
import { bigEndianCrc32, decodeIcrcAccount, hexStringToUint8Array } from "./icrcAccount";

export const HEX_REGEX = new RegExp("^[A-Fa-f0-9]+$");

export function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );
}

export function isPrincipalValid(text: string): boolean {
    try {
        Principal.fromText(text);
        return true;
    } catch (_e) {
        return false;
    }
}

export function isSubAccountValid(text: string): boolean {
    return text.length <= 64 && isHexString(text);
}

// An ICP ledger account identifier is 32 bytes: a big-endian CRC32 of the 28-byte hash, then
// the hash. Length and hex alone let a typo through to the canister, whose
// AccountIdentifier::from_slice checks the checksum and rejects it - by which point the user has
// already been told the address was fine.
export function isAccountIdentifierValid(text: string): boolean {
    if (text.length !== 64 || !isHexString(text)) return false;
    const bytes = hexStringToUint8Array(text);
    const checksum = bigEndianCrc32(bytes.subarray(4));
    return checksum.every((b, i) => b === bytes[i]);
}

export function isICRCAddressValid(text: string): boolean {
    try {
        decodeIcrcAccount(text);
        return true;
    } catch (_e) {
        return false;
    }
}

export function isHexString(text: string): boolean {
    return HEX_REGEX.test(text);
}

export function isUrl(text: string): boolean {
    try {
        new URL(text);
        return true;
    } catch {
        return false;
    }
}
