<script lang="ts">
    import { _ } from "svelte-i18n";
    import { fade } from "svelte/transition";
    import Link from "../Link.svelte";

    let show = true;
</script>

{#if show}
    <div out:fade={{ duration: 100 }} class="notification-bar">
        <div class="txt">{$_("enableNotifications")}</div>
        <div class="links">
            <Link underline="always">{$_("yesPlease")}</Link>
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
