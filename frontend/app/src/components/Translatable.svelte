<script lang="ts">
    import { type InterpolationValues } from "openchat-client";
    import Translate from "svelte-material-icons/Translate.svelte";

    import { _, locale } from "svelte-i18n";
    import { editingLabel } from "../i18n/i18n";

    export let key: string;
    export let params: InterpolationValues | undefined = undefined;

    $: editable = !$locale?.startsWith("en");

    function editLabel() {
        editingLabel.set(key);
    }
</script>

<span>
    {$_(key, params)}
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
