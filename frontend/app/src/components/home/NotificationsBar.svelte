<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { fade } from "svelte/transition";
    import Link from "../Link.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    $: notificationStatus = client.notificationStatus;
    $: anonUser = client.anonUser;

    $: console.debug("PUSH STATUS: ", $notificationStatus);
</script>

{#if !$anonUser && $notificationStatus === "prompt"}
    <div in:fade={{ duration: 100 }} out:fade={{ duration: 100 }} class="notification-bar">
        <div class="txt"><Translatable resourceKey={i18nKey("enableNotifications")} /></div>
        <div class="links">
            <Link on:click={() => client.askForNotificationPermission()} underline="always"
                ><Translatable resourceKey={i18nKey("yesPlease")} /></Link>
            <Link on:click={() => client.setSoftDisabled(true)} underline="always"
                ><Translatable resourceKey={i18nKey("noThanks")} /></Link>
        </div>
    </div>
{/if}

<style lang="scss">
    :global(.links a) {
        margin-right: $sp3;
        text-decoration-color: var(--notificationBar-txt) !important;
        color: inherit;
    }

    .notification-bar {
        padding: $sp3;
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: toRem(60);
        @include z-index("notification-banner");

        @include mobile() {
            padding: $sp4;
            height: unset;
            margin-bottom: 0;
            text-align: center;

            @include safezone() {
                padding-bottom: calc($sp4 + var(--safe-area-inset-bottom));
            }
        }
    }

    .txt {
        @include font(bold, normal, fs-90);
        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    .links {
        @include font(book, italic, fs-90);
        @include mobile() {
            @include font-size(fs-100);
        }
    }
</style>
