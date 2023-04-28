<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import page from "page";

    export let rootPath = "/";
    export let text = "Launch app";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: identityState = client.identityState;
    $: txt = $identityState === "logging_in" ? "Logging in..." : text;

    function launch() {
        if ($identityState === "logged_in") {
            page(rootPath);
        } else {
            dispatch("login");
        }
    }
</script>

<div role="button" on:click={launch} class="launch">{txt}</div>

<style type="text/scss">
    .launch {
        display: inline-block;
        transition: background-color ease-in-out 200ms;
        color: #fff;
        background-color: var(--primary);
        border: none;
        border-radius: toRem(4);
        cursor: pointer;
        text-decoration: none;
        @include font(bold, normal, fs-100);
        padding: toRem(12) toRem(16) toRem(12) toRem(16);

        @include mobile() {
            @include font(bold, normal, fs-120);
            padding: toRem(16) toRem(20);
            width: 100%;
            text-align: center;
        }
    }
</style>
