import { isMultiUserCanisterUser, userCanisterId, userIndexWithinCanister } from "./userId";

// The urls of the blobs the canisters serve over http: files, avatars, banners, profile backgrounds
// and token logos. `pattern` is the configured `blobUrlPattern`, such as
// "https://{canisterId}.raw.icp0.io/{blobType}", into which the canister and the path within it are
// substituted.

export type BlobType = "blobs" | "avatar" | "banner" | "profile_background";

export type BlobUrlOptions = {
    // The channel, within the community which owns the blob, that it belongs to
    channelId?: number;
    // The bot or webhook, registered with the canister which owns the blob, whose avatar it is
    botId?: string;
};

// The url of a blob belonging to `ownerId`: the canister which serves it, such as a group, community
// or storage bucket, or a user, whose blobs are served by the canister holding them (see
// `blobLocation`)
export function buildBlobUrl(
    pattern: string,
    ownerId: string,
    blobId: bigint,
    blobType: BlobType,
    { channelId, botId }: BlobUrlOptions = {},
): string {
    const location =
        channelId === undefined
            ? blobLocation(ownerId, blobType)
            : { canisterId: ownerId, path: `channel/${channelId}/${blobType}` };
    const botSegment = botId === undefined ? "" : `/${botId}`;

    return `${fillPattern(pattern, location.canisterId, location.path)}${botSegment}/${blobId}`;
}

// The url of the logo of the token on `ledger`, which the Registry canister serves
export function buildTokenLogoUrl(
    pattern: string,
    registryCanisterId: string,
    ledger: string,
    logoId: bigint,
): string {
    return `${fillPattern(pattern, registryCanisterId, "logo")}?ledger=${ledger}&id=${logoId}`;
}

// Where the blobs of `ownerId`, such as its avatar, are served: the canister to fetch them from and
// the path under which that canister serves blobs of `blobType`. A group, community or user alone in
// their canister serves its own at its root. A MultiUser canister serves those of each of its users
// under `user/{index}`, where `index` is the user's index within it (see `Route::User` in
// backend/libraries/http_request).
export function blobLocation(
    ownerId: string,
    blobType: string,
): { canisterId: string; path: string } {
    if (!isMultiUserCanisterUser(ownerId)) {
        return { canisterId: ownerId, path: blobType };
    }
    return {
        canisterId: userCanisterId(ownerId).toText(),
        path: `user/${userIndexWithinCanister(ownerId)}/${blobType}`,
    };
}

function fillPattern(pattern: string, canisterId: string, path: string): string {
    return pattern.replace("{canisterId}", canisterId).replace("{blobType}", path);
}
