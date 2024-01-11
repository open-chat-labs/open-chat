<script lang="ts">
    import Translate from "svelte-material-icons/Translate.svelte";

    import { _, locale } from "svelte-i18n";
    import { editmode, editingLabel, type ResourceKey, interpolate } from "../i18n/i18n";

    export let resourceKey: ResourceKey;

    $: editable = $editmode && !$locale?.startsWith("en");

    function editLabel() {
        editingLabel.set(resourceKey);
    }
</script>

<span>
    {interpolate($_, resourceKey)}
</span>

{#if editable}
    <span role="button" tabindex="0" class="edit" on:click|stopPropagation={editLabel}>
        <Translate color={"var(--accent)"} size={"0.8em"} />
    </span>
{/if}

<style lang="scss">
    .edit {
        cursor: pointer;
    }
</style>
