<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import page from "page";
    import { _ } from "svelte-i18n";
    import { routeForScope } from "../../routes";

    const client = getContext<OpenChat>("client");

    export let rootPath = routeForScope(client.getDefaultScope());
    export let text = "Launch app";
    export let login = false;

    $: identityState = client.identityState;

    function launch() {
        if ($identityState.kind === "logged_in") {
            page(rootPath);
        } else {
            if (login) {
                client.login();
            } else {
                page("/communities");
            }
        }
    }
</script>

<div tabindex="0" role="button" on:click={launch} class="launch">{text}</div>

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
        @include font(bold, normal, fs-100);
        padding: toRem(12) toRem(16) toRem(12) toRem(16);

        &:hover {
            background-color: var(--button-hv);
        }

        @include mobile() {
            @include font(bold, normal, fs-120);
            padding: toRem(16) toRem(20);
            width: 100%;
            text-align: center;
        }
    }
</style>
