<script lang="ts">
    import { _ } from "svelte-i18n";

    export let me: boolean;
    export let searchTerm = "";
    export let username: string | undefined;

    $: name = username ?? $_("unknownUser");
    $: lower = name.toLowerCase();
    $: index = searchTerm === "" ? -1 : lower.indexOf(searchTerm);
    $: prefix = name.substring(0, index);
    $: match = name.substring(index, index + searchTerm.length);
    $: postfix = name.substring(index + searchTerm.length);
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
