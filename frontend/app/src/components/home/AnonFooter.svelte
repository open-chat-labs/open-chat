<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");
</script>

<div
    role="button"
    tabindex="0"
    on:click={() => client.identityState.set({ kind: "logging_in", prompt: $_("loginToOpenChat") })}
    class="anon">
    {$_("tapToLogin")}
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
