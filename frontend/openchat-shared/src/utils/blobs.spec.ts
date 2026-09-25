import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { blobLocation, buildBlobUrl, buildTokenLogoUrl } from "./blobs";

const pattern = "https://{canisterId}.raw.icp0.io/{blobType}";
const canisterId = "dfdal-2uaaa-aaaaa-qaama-cai";
// `UserId::new_indexed(canisterId, 1000)` in backend/libraries/types/src/user.rs
const indexedUserId = "svgk6-q4aaa-aaaaa-qaamo-ray";
const botId = Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).toText();

describe("buildBlobUrl", () => {
    test("a blob is served by the canister which owns it", () => {
        expect(buildBlobUrl(pattern, canisterId, 7n, "blobs")).toBe(
            `https://${canisterId}.raw.icp0.io/blobs/7`,
        );
        expect(buildBlobUrl(pattern, canisterId, 7n, "banner")).toBe(
            `https://${canisterId}.raw.icp0.io/banner/7`,
        );
    });

    test("a user in a MultiUser canister is served by it under their index", () => {
        expect(buildBlobUrl(pattern, indexedUserId, 7n, "avatar")).toBe(
            `https://${canisterId}.raw.icp0.io/user/1000/avatar/7`,
        );
        expect(buildBlobUrl(pattern, indexedUserId, 7n, "profile_background")).toBe(
            `https://${canisterId}.raw.icp0.io/user/1000/profile_background/7`,
        );
    });

    test("a channel's blob is under the channel in its community", () => {
        expect(buildBlobUrl(pattern, canisterId, 7n, "avatar", { channelId: 42 })).toBe(
            `https://${canisterId}.raw.icp0.io/channel/42/avatar/7`,
        );
    });

    test("a bot's or webhook's avatar is under its id in the canister it is registered with", () => {
        expect(buildBlobUrl(pattern, canisterId, 7n, "avatar", { botId })).toBe(
            `https://${canisterId}.raw.icp0.io/avatar/${botId}/7`,
        );
        expect(buildBlobUrl(pattern, canisterId, 7n, "avatar", { channelId: 42, botId })).toBe(
            `https://${canisterId}.raw.icp0.io/channel/42/avatar/${botId}/7`,
        );
    });
});

describe("buildTokenLogoUrl", () => {
    test("a token's logo is served by the Registry, by ledger and logo id", () => {
        expect(buildTokenLogoUrl(pattern, canisterId, "ryjl3-tyaaa-aaaaa-aaaba-cai", 7n)).toBe(
            `https://${canisterId}.raw.icp0.io/logo?ledger=ryjl3-tyaaa-aaaaa-aaaba-cai&id=7`,
        );
    });
});

describe("blobLocation", () => {
    test("a user in a MultiUser canister is served by it under their index", () => {
        expect(blobLocation(indexedUserId, "avatar")).toEqual({
            canisterId,
            path: "user/1000/avatar",
        });
        expect(blobLocation("qp43m-xeaaa-aaaaa-qaama-daa", "profile_background")).toEqual({
            canisterId,
            path: "user/1/profile_background",
        });
    });

    test("anything else is served by its own canister at its root", () => {
        expect(blobLocation(canisterId, "avatar")).toEqual({ canisterId, path: "avatar" });
        expect(blobLocation(botId, "avatar")).toEqual({ canisterId: botId, path: "avatar" });
    });
});
