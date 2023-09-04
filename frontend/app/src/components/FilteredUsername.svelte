<script lang="ts">
    import { _ } from "svelte-i18n";

    export let me = false;
    export let searchTerm = "";
    export let username: string | undefined;

    $: name = username ?? $_("unknownUser");
    $: lower = name.toLowerCase();
    $: searchTermLower = searchTerm.toLowerCase();
    $: index = searchTermLower === "" ? -1 : lower.indexOf(searchTermLower);
    $: prefix = name.substring(0, index);
    $: match = name.substring(index, index + searchTermLower.length);
    $: postfix = name.substring(index + searchTermLower.length);
</script>

{#if me}
    {$_("you")}
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
