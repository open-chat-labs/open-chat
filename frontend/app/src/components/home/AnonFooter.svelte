<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "@components/home/Markdown.svelte";

    const client = getContext<OpenChat>("client");
</script>

<div
    role="button"
    tabindex="0"
    on:click={() => client.updateIdentityState({ kind: "logging_in" })}
    class="anon-footer">
    <Markdown text={$_("createAccountOrSignIn")} />
</div>

<style lang="scss">
    .anon-footer {
        position: absolute;
        height: toRem(50);
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        bottom: 0;
        bottom: var(--safe-inset);
        cursor: pointer;
        @include z-index("anon-banner");
        background-color: var(--notificationBar-bg);
        color: var(--notificationBar-txt);
        padding: $sp4 $sp3;
        font-size: 1.2rem;
    }
</style>
