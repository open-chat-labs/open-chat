import { LazyFile } from "@client";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
    exportMedia,
    loadRecentMedia,
    type MediaPermissionStatus,
    type RecentMedia,
} from "tauri-plugin-oc-api";

export type { RecentMedia };

// The phone's recent photos and videos (the apps' plugin, loadRecentMedia): listed newest first
// with a thumbnail each, and one picked turned into a file to attach. Asking lists them only once
// the user has let the app see them (Android asks then).

/** The recent photos and videos, or why there are none to show. */
export type RecentMediaList =
    | { kind: "listed"; media: RecentMedia[] }
    | { kind: "not_allowed"; permission: Exclude<MediaPermissionStatus, "granted"> }
    | { kind: "failed" };

/** The `count` most recent photos and videos on the phone, newest first. */
export async function recentMedia(count: number): Promise<RecentMediaList> {
    try {
        const { permission, media } = await loadRecentMedia({ count, offset: 0 });
        return permission === "granted"
            ? { kind: "listed", media }
            : { kind: "not_allowed", permission };
    } catch (err) {
        console.warn("Couldn't list the recent photos and videos", err);
        return { kind: "failed" };
    }
}

/** What to show for one: its thumbnail, else the file itself. */
export function recentMediaThumbnail(media: RecentMedia): string | undefined {
    if (media.thumbnail) return media.thumbnail;
    return media.filePath ? convertFileSrc(media.filePath) : undefined;
}

/** Where the file itself can be read from, where it has a path (Android); else undefined. */
export function recentMediaUrl(media: RecentMedia): string | undefined {
    return media.filePath ? convertFileSrc(media.filePath) : undefined;
}

/**
 * One picked, as a file to attach. iOS photo-library items have no file path until the asset is
 * exported to a temp file (`uri` is the PHAsset's identifier). Rejects if it can't be.
 */
export async function recentMediaFile(media: RecentMedia): Promise<LazyFile> {
    const { filename, mimeType, size } = media;
    const filePath = media.filePath || (await exportMedia(media.uri));
    return LazyFile.fromUrl(convertFileSrc(filePath), filename, mimeType, size);
}
