<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { Body, BodySmall, ColourVars, Column, Row } from "component-lib";
    import { OpenChat, Poller, Version } from "openchat-client";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import { activeVideoCall } from "../stores/video";
    import Translatable from "./Translatable.svelte";

    const VERSION_INTERVAL = 60 * 1000;
    const client = getContext<OpenChat>("client");

    let poller = new Poller(checkVersion, VERSION_INTERVAL);
    // @ts-ignore
    let clientVersion = Version.parse(window.OC_WEBSITE_VERSION);
    let serverVersion = $state(clientVersion);
    let countdown = $state(30);
    let showBanner = $state(false);
    let errorCount = 0;

    onDestroy(() => poller.stop());

    function checkVersion(): Promise<void> {
        console.log("Checking version");
        if (import.meta.env.OC_NODE_ENV !== "production" || $activeVideoCall !== undefined) {
            console.log("Bailing out of version check");
            return Promise.resolve();
        }
        return getServerVersion().then(async (sv) => {
            console.log("Got server version of: ", sv);
            serverVersion = sv;
            if (serverVersion.isGreaterThan(clientVersion)) {
                if (client.isNativeApp()) {
                    console.log("About to tell the android shell to update itself");
                    try {
                        const updated = await invoke("download_update");
                        if (!updated) {
                            console.log("Native update failed or was not needed");
                            return;
                        }
                    } catch (e) {
                        console.error("Failed to download native update", e);
                        return;
                    }
                }

                poller.stop();
                countdown = 30;
                showBanner = true;
                const interval = window.setInterval(() => {
                    countdown = countdown - 1;
                    if (countdown === 0) {
                        window.clearInterval(interval);
                        if (client.isNativeApp()) {
                            invoke("restart_app");
                        } else {
                            window.location.reload();
                        }
                    }
                }, 1000);
            } else {
                console.log("Server version is not greater than client version", clientVersion);
            }
        });
    }

    function getServerVersion(): Promise<Version> {
        if (client.isNativeApp()) {
            return invoke<string>("get_server_version").then((v) => Version.parse(v));
        }

        return fetch("/version", {
            method: "get",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((res) => res.json())
            .then((res) => {
                client.logMessage("Server version: ", res);
                errorCount = 0;
                return Version.parse(res.version);
            })
            .catch((err) => {
                errorCount += 1;
                client.logError(`Unable to load server version ${errorCount} times`, err);
                return clientVersion;
            });
    }

    function reload(ev: Event) {
        if (client.isNativeApp()) {
            invoke("restart_app");
        } else {
            window.location.reload();
        }
        ev.preventDefault();
    }
</script>

{#if showBanner}
    <Column
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        backgroundColor={ColourVars.warning}
        padding={"lg"}
        supplementalClass={"upgrade_banner"}>
        <Row wrap>
            <Body width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("updateRequired", { countdown })} />
            </Body>
        </Row>
        <BodySmall width={"hug"} fontWeight={"light"}>
            <a href="/" onclick={reload}><Translatable resourceKey={i18nKey("updateNow")} /></a>
        </BodySmall>
    </Column>
{/if}

<style lang="scss">
    :global(.container.upgrade_banner) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        @include z-index("upgrade-banner");
    }

    a {
        text-decoration: underline;
        text-underline-offset: $sp1;
        cursor: pointer;
        color: inherit;
    }
</style>
