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

// The IC's canister ids are a big-endian u64 followed by two class tag bytes, so they are always
// exactly this long and always end in exactly these bytes.
const CANISTER_ID_LENGTH = 10;
const CANISTER_ID_TAG = [0x01, 0x01];
// Set in a UserId's final byte to mark it as carrying the user's index within their canister. No
// class tag the IC defines has the top bit set, so a byte which does cannot be one.
const INDEXED_TAG = 0x80;
// Every ICRC-1 subaccount is exactly this long, the index occupying the final two bytes.
const SUBACCOUNT_LENGTH = 32;
// The largest index the seven spare bits of a UserId's final byte, plus the byte before it, hold.
const MAX_USER_INDEX = (1 << 15) - 1;

// The ledger account holding a user's funds, which is also the account their canister spends as
// when pulling from an external wallet via ICRC-2. Mirrors `impl From<UserId> for Account` in
// backend/libraries/types/src/user.rs: the owner is the canister holding the user rather than the
// UserId itself, since nobody can sign for an indexed UserId, and the user's index within that
// canister goes in the subaccount. Index 0 maps to no subaccount so that users who predate indexing
// keep the address they already have.
export function userIdToIcrcAccount(userId: string): IcrcAccount {
    const bytes = Principal.fromText(userId).toUint8Array();
    const index = userIndex(bytes);

    if (index === 0) {
        return { owner: Principal.fromUint8Array(canisterIdBytes(bytes)) };
    }

    const subaccount = new Uint8Array(SUBACCOUNT_LENGTH);
    subaccount[SUBACCOUNT_LENGTH - 2] = (index >> 8) & 0xff;
    subaccount[SUBACCOUNT_LENGTH - 1] = index & 0xff;

    return { owner: Principal.fromUint8Array(canisterIdBytes(bytes)), subaccount };
}

// Rebuilding the canister id means restoring the two tag bytes the index displaced.
function canisterIdBytes(bytes: Uint8Array): Uint8Array {
    if (!isIndexed(bytes)) return bytes;

    const canisterId = new Uint8Array(CANISTER_ID_LENGTH);
    canisterId.set(bytes.subarray(0, 8));
    canisterId.set(CANISTER_ID_TAG, 8);
    return canisterId;
}

function userIndex(bytes: Uint8Array): number {
    if (!isIndexed(bytes)) return 0;

    return bytes[8] | ((bytes[9] & ~INDEXED_TAG) << 8);
}

function isIndexed(bytes: Uint8Array): boolean {
    return (
        bytes.length === CANISTER_ID_LENGTH && (bytes[CANISTER_ID_LENGTH - 1] & INDEXED_TAG) !== 0
    );
}

// The user whose wallet this ledger account is - the inverse of `userIdToIcrcAccount`, mirroring
// `UserId::from_account` in backend/libraries/types/src/user.rs. Undefined for an account which is
// not a user's wallet: one whose subaccount is not of the form `userIdToIcrcAccount` produces, or
// an indexed subaccount of an owner which is not a canister. The default subaccount maps to the
// owner itself, whether or not that is a canister, so the wallets of bots and other non-canister
// users resolve too.
//
// There is no equivalent for the ICP ledger's AccountIdentifier, which is a hash and so cannot be
// inverted.
export function icrcAccountToUserId({ owner, subaccount }: IcrcAccount): string | undefined {
    const index = subaccountIndex(subaccount);

    if (index === undefined) return undefined;
    if (index === 0) return owner.toText();
    if (index > MAX_USER_INDEX || !isCanisterId(owner)) return undefined;

    return indexedUserId(owner, index);
}

// The index a subaccount carries, or undefined if it is not one `userIdToIcrcAccount` produces.
// Both the default subaccount and an all-zero one mean index 0.
function subaccountIndex(subaccount: Uint8Array | undefined): number | undefined {
    if (subaccount === undefined) return 0;
    if (subaccount.length !== SUBACCOUNT_LENGTH) return undefined;
    if (!subaccount.subarray(0, SUBACCOUNT_LENGTH - 2).every((b) => b === 0)) return undefined;

    return (subaccount[SUBACCOUNT_LENGTH - 2] << 8) | subaccount[SUBACCOUNT_LENGTH - 1];
}

// Mirrors `UserId::new_indexed`: the index takes the place of the canister id's two trailing tag
// bytes, which is what `canisterIdBytes` reverses.
function indexedUserId(canisterId: Principal, index: number): string {
    const bytes = new Uint8Array(CANISTER_ID_LENGTH);
    bytes.set(canisterId.toUint8Array().subarray(0, 8));
    bytes[8] = index & 0xff;
    bytes[9] = INDEXED_TAG | (index >> 8);
    return Principal.fromUint8Array(bytes).toText();
}

// Both the length and the trailing tag bytes, because `indexedUserId` rebuilds an id from the
// leading 8 alone. Anything else of canister id length would pass a length check and then come
// back as some other canister entirely.
function isCanisterId(principal: Principal): boolean {
    const bytes = principal.toUint8Array();
    return (
        bytes.length === CANISTER_ID_LENGTH &&
        bytes[8] === CANISTER_ID_TAG[0] &&
        bytes[9] === CANISTER_ID_TAG[1]
    );
}
