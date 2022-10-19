<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { fade } from "svelte/transition";
    import Link from "../Link.svelte";

    const client = getContext<OpenChat>("client");

    $: notificationStatus = client.notificationStatus;

    $: console.log("STATUS: ", $notificationStatus);
</script>

{#if $notificationStatus === "prompt"}
    <div in:fade={{ duration: 100 }} out:fade={{ duration: 100 }} class="notification-bar">
        <div class="txt">{$_("enableNotifications")}</div>
        <div class="links">
            <Link on:click={() => client.askForNotificationPermission()} underline="always"
                >{$_("yesPlease")}</Link>
            <Link on:click={() => client.setSoftDisabled(true)} underline="always"
                >{$_("noThanks")}</Link>
        </div>
    </div>
{/if}

<style type="text/scss">
    :global(.links a) {
        margin-right: $sp3;
        text-decoration-color: var(--notificationBar-txt) !important;
        color: inherit;
    }

    .notification-bar {
        padding: $sp4;
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;

        @include mobile() {
            margin-bottom: 0;
        }
    }

    .txt {
        @include font(bold, normal, fs-90);
        margin-bottom: $sp3;
    }

    .links {
        @include font(book, italic, fs-90);
    }
</style>
