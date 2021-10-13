<script lang="ts">
    import { onMount } from "svelte";

    import { _ } from "svelte-i18n";
    import { fade } from "svelte/transition";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import type { NotificationStatus } from "../../utils/notifications";
    import { askForPermission } from "../../utils/notifications";
    import { notificationStatus, trySubscribe } from "../../utils/notifications";
    import Link from "../Link.svelte";

    export let userId: string;
    export let api: ServiceContainer;

    let show = false;
    let status: NotificationStatus = "prompt";

    onMount(async () => {
        status = await notificationStatus();
        if (status === "prompt") {
            show = true;
        } else if (status === "granted") {
            trySubscribe(api, userId);
        }
    });

    async function onEnable() {
        try {
            const permission = await askForPermission();
            show = false;
            if (permission === "granted") {
                trySubscribe(api, userId);
            }
        } catch (err) {
            console.log("error getting notification permission: ", err);
        }
    }
</script>

{#if show}
    <div in:fade={{ duration: 100 }} out:fade={{ duration: 100 }} class="notification-bar">
        <div class="txt">{$_("enableNotifications")}</div>
        <div class="links">
            <Link on:click={onEnable} underline="always">{$_("yesPlease")}</Link>
            <Link on:click={() => (show = false)} underline="always">{$_("noThanks")}</Link>
        </div>
    </div>
{/if}

<style type="text/scss">
    :global(.links a) {
        margin-right: $sp3;
        text-decoration-color: var(--notificationBar-txt) !important;
    }

    .notification-bar {
        padding: $sp4;
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        margin-bottom: $sp3;

        @include size-below(xs) {
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
