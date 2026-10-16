import { invoke } from "@tauri-apps/api/core";
import { Version } from "@client";
import type { VersionState } from "./version.svelte";

// Most Android releases only refresh the web bundle the APK ships with, and a
// user taking OTA updates already has that, so a new APK is only worth
// announcing when its native code differs from the installed shell's. The
// release workflow records this in each GitHub release body as the oldest
// release whose native code is identical to it. A shell at or above that
// version is running the same native code, whatever its web bundle.
export const NATIVE_MARKER = /<!-- native-version: (\d+\.\d+\.\d+) -->/;

const ANDROID_TAG = /^v(\d+\.\d+\.\d+)-android$/;

const RELEASES_URL = "https://api.github.com/repos/open-chat-labs/open-chat/releases";

export type Release = { tag_name: string; body: string | null };

// Returns the release's version when installing it would change the native
// code. Anything unexpected returns undefined: a release without the marker
// predates it or was edited, and guessing would announce an APK that may
// change nothing.
export function shellUpdateFrom(
    shellVersion: string | undefined,
    release: Release | undefined,
): Version | undefined {
    if (shellVersion === undefined || release === undefined) return undefined;
    const tag = ANDROID_TAG.exec(release.tag_name);
    const marker = NATIVE_MARKER.exec(release.body ?? "");
    if (tag === null || marker === null) return undefined;
    const nativeVersion = Version.parse(marker[1]);
    return nativeVersion.isGreaterThan(Version.parse(shellVersion))
        ? Version.parse(tag[1])
        : undefined;
}

// The inverse of the versionCode formula in src-tauri/gen/android/app/build.gradle.kts.
export function versionFromCode(versionCode: number): Version {
    const major = Math.floor(versionCode / 1_000_000);
    const minor = Math.floor((versionCode % 1_000_000) / 10_000);
    return Version.parse(`${major}.${minor}.${versionCode % 10_000}`);
}

// Which release to compare against. A sideloaded build can install the latest
// GitHub release the moment it is published. A store build can only install
// what Play offers this user, which lags GitHub by review and staged rollout,
// and announcing an update Play does not offer yet is worse than silence. So
// a store build only asks about the release Play offers, and nothing when
// Play offers nothing.
export function releasePath(
    storeBuild: boolean,
    storeOffer: Version | undefined,
): string | undefined {
    if (!storeBuild) return "latest";
    return storeOffer === undefined ? undefined : `tags/v${storeOffer.toText()}-android`;
}

// Whether installing what Play offers lets a store build, which only takes
// patch updates over the air, reach the website's version.
export function storeOfferReaches(storeOffer: Version | undefined, target: Version): boolean {
    if (storeOffer === undefined) return false;
    return !target.isGreaterThan(storeOffer) || storeOffer.canUpdateTo(target, "patch");
}

// The version for the dismissible "update available" sheet, if it should show.
// The shell notice waits for the bundle check to settle, so it never appears
// and is then replaced by the blocking or downloading sheet. A store minor bump
// shows only once Play offers a build that gets there: before that the store
// listing has nothing to install.
export function noticeVersion(
    state: VersionState,
    storeOffer: Version | undefined,
    newerShell: string | undefined,
): string | undefined {
    switch (state.kind) {
        case "store_update_available":
            return storeOfferReaches(storeOffer, state.available)
                ? state.available.toText()
                : newerShell;
        case "up_to_date":
        case "failed_update":
            return newerShell;
        default:
            return undefined;
    }
}

// Unauthenticated GitHub API calls are limited to 60 an hour per IP, so this
// is fetched once per launch and never polled. Any failure means no notice.
export async function fetchRelease(path: string): Promise<Release | undefined> {
    try {
        const resp = await fetch(`${RELEASES_URL}/${path}`, {
            headers: { Accept: "application/vnd.github+json" },
        });
        if (!resp.ok) return undefined;
        const body: { tag_name?: unknown; body?: unknown } = await resp.json();
        if (typeof body.tag_name !== "string") return undefined;
        return {
            tag_name: body.tag_name,
            body: typeof body.body === "string" ? body.body : null,
        };
    } catch {
        return undefined;
    }
}

// The release Play offers this user, if any. Only a store build may ask: a
// sideloaded build is not installed by Play, and Play would describe some
// other install of the package. A shell older than get_store_update rejects,
// and that means no offer, like any other failure.
export async function getStoreOffer(): Promise<Version | undefined> {
    try {
        const { versionCode } = await invoke<{ versionCode?: number }>(
            "plugin:oc|get_store_update",
        );
        return versionCode === undefined ? undefined : versionFromCode(versionCode);
    } catch {
        return undefined;
    }
}
