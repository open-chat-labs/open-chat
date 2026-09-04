
/**
 * This a class that will perform version checks and handle the state of and native downloads
 * Note that this will only do anything for native. The update mechanism is different for web.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Poller, Version, type OTAUpdateStrategy } from "@client";
import { isAndroidTauriApp } from "@shared";

const VERSION_INTERVAL = 60 * 1000;

type VersionState =
    | { kind: "unknown" }
    | { kind: "up_to_date" }
    | { kind: "failed_update"; available: Version; error: unknown }
    // A newer version exists but the OTA strategy refuses it. Two different
    // situations, and conflating them walls users out of a working app:
    //
    // "incompatible" - a major bump. This shell genuinely cannot run the new
    // bundle, and per the release-train runbook the store update is already
    // live by the time the website announces a major, so sending the user
    // there works.
    //
    // "store_update_available" - a minor bump on a store build. Any shell can
    // run it; it is held back only so Play reviews the feature. The Play
    // listing may show nothing for days while review and staged rollout run,
    // so this must not block anything.
    | { kind: "incompatible"; available: Version }
    | { kind: "store_update_available"; available: Version }
    | { kind: "out_of_date"; available: Version; downloadProgress: number };

export class VersionChecker {
    #clientVersion = Version.parse(import.meta.env.OC_WEBSITE_VERSION);
    #versionState = $state<VersionState>({ kind: "unknown" });
    #strategy: OTAUpdateStrategy = import.meta.env.OC_OTA_UPDATES;
    #poller = this.#startPoller(true);

    get versionState() {
        return this.#versionState;
    }

    #startPoller(immediate: boolean) {
        // this should only operate if we are in the android app and the ota strategy is not set to none
        if (!isAndroidTauriApp() || this.#strategy === "none") {
            this.#versionState = { kind: "up_to_date" };
            return;
        }
        return new Poller(() => this.#checkVersion(), VERSION_INTERVAL, undefined, immediate);
    }

    #checkVersion() {
        return this.#getServerVersion().then(async (sv) => {
            if (sv === undefined) return;

            if (this.#clientVersion.canUpdateTo(sv, this.#strategy)) {
                this.#poller?.stop();

                this.#versionState = {
                    kind: "out_of_date",
                    available: sv,
                    downloadProgress: 0,
                };

                let unsubscribe: UnlistenFn | undefined;

                try {
                    // listen out for download progress
                    unsubscribe = await listen<{ progress: number }>("update-progress", (event) => {
                        if (this.#versionState.kind === "out_of_date") {
                            this.#versionState.downloadProgress = event.payload.progress;
                        }
                    });

                    console.log("About to tell the android shell to update itself");
                    const updated = await invoke?.("plugin:oc|download_update");
                    if (!updated) {
                        this.#versionState = {
                            kind: "failed_update",
                            available: sv,
                            error: "tauri shell did not download the update",
                        };
                        console.log("Native update failed or was not needed");
                    } else {
                        if (this.#versionState.kind === "out_of_date") {
                            this.#versionState.downloadProgress = 100;
                        }
                    }
                } catch (e) {
                    this.#versionState = { kind: "failed_update", available: sv, error: e };
                    console.error("Failed to download native update", e);
                    return;
                } finally {
                    unsubscribe?.();
                    // Must reassign: #poller still points at the instance
                    // stopped above, so dropping this would leave the live
                    // poller unreachable - stop() and onDestroy would both
                    // act on the dead one while it kept firing.
                    this.#poller = this.#startPoller(false);
                }
            } else if (sv.isGreaterThan(this.#clientVersion)) {
                // Newer, but across a boundary the strategy will not cross. No
                // amount of polling changes that - only a new binary does - so
                // stop asking and tell the user.
                //
                // Whether this shell could have run the bundle is a separate
                // question from whether the strategy allowed it: "minor" is
                // exactly the test for "same major", i.e. no new native code
                // needed.
                const runnable = this.#clientVersion.canUpdateTo(sv, "minor");
                this.#poller?.stop();
                this.#versionState = runnable
                    ? { kind: "store_update_available", available: sv }
                    : { kind: "incompatible", available: sv };
                console.log(
                    `Server version (${sv.toText()}) cannot be applied over the air to client version (${this.#clientVersion.toText()}) under strategy "${this.#strategy}" (runnable by this shell: ${runnable})`,
                );
            } else {
                this.#versionState = { kind: "up_to_date" };
                console.log(
                    `Server version (${sv.toText()}) is not greater than client version (${this.#clientVersion.toText()})`,
                );
            }
        });
    }

    #getServerVersion(): Promise<Version> {
        return invoke<string>?.("plugin:oc|get_server_version").then((v) => Version.parse(v));
    }

    reload() {
        invoke?.("plugin:oc|restart_app");
    }

    stop() {
        this.#poller?.stop();
    }
}
