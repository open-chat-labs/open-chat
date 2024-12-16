<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { identityState } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { routeForScope } from "../../routes";

    const client = getContext<OpenChat>("client");

    export let rootPath = routeForScope(client.getDefaultScope());
    export let text = "Launch app";
    export let login = false;

    $: url = $identityState.kind === "logged_in" ? rootPath : "/communities";
    $: busy = $identityState.kind === "logging_in" || $identityState.kind === "loading_user";
</script>

{#if login}
    <div
        class:loading={busy}
        role="button"
        tabindex="0"
        on:click={() => client.login()}
        class="launch">
        {#if !busy}
            {text}
        {/if}
    </div>
{:else}
    <a href={url} class="launch">{text}</a>
{/if}

<style lang="scss">
    .launch {
        display: inline-block;
        transition: background-color ease-in-out 200ms;
        color: var(--button-txt);
        background-color: var(--button-bg);
        border: none;
        border-radius: toRem(4);
        cursor: pointer;
        text-decoration: none;
        min-height: 45px;
        min-width: 150px;
        text-align: center;
        @include font(bold, normal, fs-100);
        padding: toRem(12) toRem(16) toRem(12) toRem(16);

        &:hover {
            background-color: var(--button-hv);
        }

        @include mobile() {
            @include font(bold, normal, fs-120);
            padding: toRem(16) toRem(20);
            width: 100%;
        }

        &.loading {
            @include loading-spinner(
                1em,
                0.5em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );
        }
    }
</style>
