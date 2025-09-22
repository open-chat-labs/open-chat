<script lang="ts">
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        me?: boolean;
        searchTerm?: string;
        username: string | undefined;
    }

    let { me = false, searchTerm = "", username }: Props = $props();

    let name = $derived(username ?? $_("unknownUser"));
    let lower = $derived(name.toLowerCase());
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let index = $derived(searchTermLower === "" ? -1 : lower.indexOf(searchTermLower));
    let prefix = $derived(name.substring(0, index));
    let match = $derived(name.substring(index, index + searchTermLower.length));
    let postfix = $derived(name.substring(index + searchTermLower.length));
</script>

{#if me}
    <Translatable resourceKey={i18nKey("you")} />
{:else if index === -1}
    {name}
{:else}
    {#if prefix !== ""}
        <span class="pre">{prefix}</span>
    {/if}
    <span class="match">{match}</span>
    {#if postfix !== ""}
        <span class="post">{postfix}</span>
    {/if}
{/if}

<style lang="scss">
    .match {
        color: var(--txt);
    }

    .pre,
    .post {
        color: var(--txt-light);
    }

    .pre {
        margin-right: -3px;
    }

    .post {
        margin-left: -3px;
    }
</style>
