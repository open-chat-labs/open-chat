/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * This a class that will perform version checks and handle the state of and native downloads
 * Note that this will only do anything for native. The update mechanism is different for web.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Poller, Version, type OTAUpdateStrategy } from "openchat-client";

const VERSION_INTERVAL = 60 * 1000;

type VersionState =
    | { kind: "unknown" }
    | { kind: "up_to_date" }
    | { kind: "failed_update"; available: Version; error: unknown }
    | { kind: "out_of_date"; compatible: boolean; available: Version; downloadProgress: number };

export class VersionChecker {
    #clientVersion = Version.parse(import.meta.env.OC_WEBSITE_VERSION);
    #appType = import.meta.env.OC_APP_TYPE;
    #versionState = $state<VersionState>({ kind: "unknown" });
    #poller = this.#startPoller(true);
    #strategy: OTAUpdateStrategy = import.meta.env.OC_OTA_UPDATES;

    get versionState() {
        return this.#versionState;
    }

    #startPoller(immediate: boolean) {
        // this should only operate if we are in the android app and the ota strategy is not set to none
        if (this.#appType !== "android" || this.#strategy === "none") {
            this.#versionState = { kind: "up_to_date" };
            return;
        }
        return new Poller(() => this.#checkVersion(), VERSION_INTERVAL, undefined, immediate);
    }

    #checkVersion() {
        return this.#getServerVersion().then(async (sv) => {
            if (sv === undefined) return;

            if (sv.isGreaterThan(this.#clientVersion, this.#strategy)) {
                this.#poller?.stop();

                this.#versionState = {
                    kind: "out_of_date",
                    compatible: true,
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
                    this.#startPoller(false);
                }
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
