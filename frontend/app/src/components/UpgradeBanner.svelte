<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { OpenChat, Poller, Version } from "openchat-client";

    const VERSION_INTERVAL = 60 * 1000;
    const client = getContext<OpenChat>("client");

    let poller = new Poller(checkVersion, VERSION_INTERVAL);
    // @ts-ignore
    let clientVersion = Version.parse(window.OPENCHAT_WEBSITE_VERSION);
    let countdown = 30;
    let showBanner = false;
    let errorCount = 0;

    onDestroy(() => poller.stop());

    function checkVersion(): Promise<void> {
        if (process.env.NODE_ENV !== "production") return Promise.resolve();
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
</script>

{#if showBanner}
    <div class="upgrade-banner">
        <div class="inner">
            <span class="message">{$_("updateRequired", { values: { countdown } })}</span>
            <span class="update-now">
                <a href="/" on:click|preventDefault={() => window.location.reload()}
                    >{$_("updateNow")}</a>
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
