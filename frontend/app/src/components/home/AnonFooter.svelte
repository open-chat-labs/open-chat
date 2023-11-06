<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");
</script>

<div
    role="button"
    tabindex="0"
    on:click={() => client.identityState.set("logging_in")}
    class="anon">
    Guest mode - tap here to log in
</div>

<style lang="scss">
    .anon {
        position: absolute;
        height: toRem(50);
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        bottom: 0;
        cursor: pointer;
        @include z-index("anon-banner");
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        padding: $sp4 $sp3;
    }
</style>
