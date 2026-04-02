import { Principal } from "@icp-sdk/core/principal";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const MAX_SUBACCOUNT_HEX_LENGTH = 64;

export type IcrcAccount = {
    owner: Principal;
    subaccount?: Uint8Array;
};

export function encodeIcrcAccount({ owner, subaccount }: IcrcAccount): string {
    if (subaccount === undefined) {
        return owner.toText();
    }

    const subaccountText = uint8ArrayToHexString(subaccount).replace(/^0+/, "");

    if (subaccountText.length === 0) {
        return owner.toText();
    }

    return `${owner.toText()}-${encodeCrc({ owner, subaccount })}.${subaccountText}`;
}

export function decodeIcrcAccount(accountString: string): IcrcAccount {
    const [principalAndMaybeChecksum, subaccountHex, ...unexpected] = accountString.split(".");

    if (principalAndMaybeChecksum === undefined || principalAndMaybeChecksum.length === 0) {
        throw new Error("Invalid account. No string provided.");
    }

    if (unexpected.length > 0) {
        throw new Error("Invalid account string format. Expected at most one '.' separator.");
    }

    if (subaccountHex === undefined) {
        return { owner: Principal.fromText(accountString) };
    }

    const [checksum, ...rest] = principalAndMaybeChecksum.split("-").reverse();
    const principalText = rest.reverse().join("-");

    if (checksum === undefined || principalText.length === 0) {
        throw new Error("Invalid account. Invalid checksum.");
    }

    const account = {
        owner: Principal.fromText(principalText),
        subaccount: hexStringToUint8Array(subaccountHex.padStart(MAX_SUBACCOUNT_HEX_LENGTH, "0")),
    };

    if (encodeCrc(account) !== checksum) {
        throw new Error("Invalid account. Invalid checksum.");
    }

    return account;
}

function encodeCrc({ owner, subaccount }: Required<IcrcAccount>): string {
    const checksum = bigEndianCrc32(new Uint8Array([...owner.toUint8Array(), ...subaccount]));
    return encodeBase32(checksum);
}

function bigEndianCrc32(bytes: Uint8Array): Uint8Array {
    let crc = 0xffffffff;

    for (const byte of bytes) {
        crc ^= byte;

        for (let i = 0; i < 8; i++) {
            const mask = -(crc & 1);
            crc = (crc >>> 1) ^ (0xedb88320 & mask);
        }
    }

    const value = (crc ^ 0xffffffff) >>> 0;

    return new Uint8Array([
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ]);
}

function encodeBase32(bytes: Uint8Array): string {
    let output = "";
    let value = 0;
    let bits = 0;

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function uint8ArrayToHexString(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexStringToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
        throw new Error("Invalid account. Invalid subaccount.");
    }

    const bytes = new Uint8Array(hex.length / 2);

    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }

    return bytes;
}
