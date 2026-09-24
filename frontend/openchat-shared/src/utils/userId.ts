import { Principal } from "@icp-sdk/core/principal";

// Helpers for the layout of a UserId, mirroring `UserId` in backend/libraries/types/src/user.rs.
//
// A user with a User canister of their own is identified by that canister's id. A user held in a
// MultiUser canister alongside others is identified by that canister's leading u64 followed by
// their index within it, the index taking the place of the canister id's two trailing tag bytes.
// Bots and webhooks are identified by some other principal.

// The IC's canister ids are a big-endian u64 followed by two class tag bytes, so they are always
// exactly this long and always end in exactly these bytes.
const CANISTER_ID_LENGTH = 10;
const CANISTER_ID_TAG = [0x01, 0x01];
// Set in a UserId's final byte to mark it as carrying the user's index within their canister. No
// class tag the IC defines has the top bit set, so a byte which does cannot be one.
const INDEXED_TAG = 0x80;
// The largest index the seven spare bits of a UserId's final byte, plus the byte before it, hold.
export const MAX_USER_INDEX = (1 << 15) - 1;

// Whether the user's data is held in a MultiUser canister alongside other users', rather than in
// a User canister of their own. Mirrors `UserId::is_indexed`. False for anything which is not a
// principal, such as the anonymous user's id, so it is safe on any value the current user id holds.
export function isMultiUserCanisterUser(userId: string): boolean {
    let bytes: Uint8Array;
    try {
        bytes = Principal.fromText(userId).toUint8Array();
    } catch {
        return false;
    }
    return isIndexed(bytes);
}

// The id of the canister which holds the user's data. Mirrors `UserId::canister_id`.
export function userCanisterId(userId: string): Principal {
    const bytes = Principal.fromText(userId).toUint8Array();
    if (!isIndexed(bytes)) return Principal.fromUint8Array(bytes);

    // Rebuilding the canister id means restoring the two tag bytes the index displaced.
    const canisterId = new Uint8Array(CANISTER_ID_LENGTH);
    canisterId.set(bytes.subarray(0, 8));
    canisterId.set(CANISTER_ID_TAG, 8);
    return Principal.fromUint8Array(canisterId);
}

// The user's index within their MultiUser canister, or 0 for a user whose id is not indexed.
export function userIndexWithinCanister(userId: string): number {
    const bytes = Principal.fromText(userId).toUint8Array();
    if (!isIndexed(bytes)) return 0;

    return bytes[8] | ((bytes[9] & ~INDEXED_TAG) << 8);
}

// Where the blobs of `ownerId`, such as its avatar, are served: the canister to fetch them from and
// the path under which that canister serves blobs of `blobType`. A group, community or user alone in
// their canister serves its own at its root. A MultiUser canister serves those of each of its users
// under the user's index within it (see `Route::User` in backend/libraries/http_request).
export function blobLocation(
    ownerId: string,
    blobType: string,
): { canisterId: string; path: string } {
    if (!isMultiUserCanisterUser(ownerId)) {
        return { canisterId: ownerId, path: blobType };
    }
    return {
        canisterId: userCanisterId(ownerId).toText(),
        path: `${userIndexWithinCanister(ownerId)}/${blobType}`,
    };
}

// Mirrors `UserId::new_indexed`: the index takes the place of the canister id's two trailing tag
// bytes, which is what `userCanisterId` reverses.
export function indexedUserId(canisterId: Principal, index: number): string {
    if (!isCanisterId(canisterId)) {
        throw new Error(`Not a canister id: ${canisterId.toText()}`);
    }
    if (!Number.isInteger(index) || index < 0 || index > MAX_USER_INDEX) {
        throw new Error(`Index ${index} is out of range`);
    }

    const bytes = new Uint8Array(CANISTER_ID_LENGTH);
    bytes.set(canisterId.toUint8Array().subarray(0, 8));
    bytes[8] = index & 0xff;
    bytes[9] = INDEXED_TAG | (index >> 8);
    return Principal.fromUint8Array(bytes).toText();
}

// Both the length and the trailing tag bytes, because `indexedUserId` rebuilds an id from the
// leading 8 alone. Anything else of canister id length would pass a length check and then come
// back as some other canister entirely.
export function isCanisterId(principal: Principal): boolean {
    const bytes = principal.toUint8Array();
    return (
        bytes.length === CANISTER_ID_LENGTH &&
        bytes[8] === CANISTER_ID_TAG[0] &&
        bytes[9] === CANISTER_ID_TAG[1]
    );
}

function isIndexed(bytes: Uint8Array): boolean {
    return (
        bytes.length === CANISTER_ID_LENGTH && (bytes[CANISTER_ID_LENGTH - 1] & INDEXED_TAG) !== 0
    );
}
