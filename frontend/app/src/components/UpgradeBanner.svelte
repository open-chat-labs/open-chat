<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import { OpenChat, Poller, Version } from "openchat-client";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import { activeVideoCall } from "../stores/video";

    const VERSION_INTERVAL = 60 * 1000;
    const client = getContext<OpenChat>("client");

    let poller = new Poller(checkVersion, VERSION_INTERVAL);
    // @ts-ignore
    let clientVersion = Version.parse(window.OPENCHAT_WEBSITE_VERSION);
    let countdown = $state(30);
    let showBanner = $state(false);
    let errorCount = 0;

    onDestroy(() => poller.stop());

    function checkVersion(): Promise<void> {
        if (process.env.NODE_ENV !== "production" || $activeVideoCall !== undefined)
            return Promise.resolve();
        return getServerVersion().then((serverVersion) => {
            if (serverVersion.isGreaterThan(clientVersion)) {
                poller.stop();
                countdown = 30;
                showBanner = true;
                const interval = window.setInterval(() => {
                    countdown = countdown - 1;
                    if (countdown === 0) {
                        window.clearInterval(interval);
                        window.location.reload();
                    }
                }, 1000);
            }
        });
    }

    function getServerVersion(): Promise<Version> {
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
        window.location.reload();
        ev.preventDefault();
    }
</script>

{#if showBanner}
    <div class="upgrade-banner">
        <div class="inner">
            <span class="message"
                ><Translatable resourceKey={i18nKey("updateRequired", { countdown })} /></span>
            <span class="update-now">
                <a href="/" onclick={reload}><Translatable resourceKey={i18nKey("updateNow")} /></a>
            </span>
        </div>
    </div>
{/if}

<style lang="scss">
    .upgrade-banner {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        @include z-index("upgrade-banner");
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        padding: $sp4 $sp3;
        text-align: center;
        @include box-shadow(2);
    }

    .inner {
        max-width: 1200px;
        margin: 0 auto;
    }

    .update-now {
        margin-left: $sp4;
    }

    a {
        text-decoration: underline;
        text-underline-offset: $sp1;
        cursor: pointer;
        color: inherit;
    }
</style>
