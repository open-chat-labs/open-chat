<script lang="ts">
    import Translate from "svelte-material-icons/Translate.svelte";

    import { _, locale } from "svelte-i18n";
    import { editmode, editingLabel, type ResourceKey } from "../i18n/i18n";
    import type { MessageFormatter } from "openchat-shared";

    export let resourceKey: ResourceKey;

    $: editable = $editmode && !$locale?.startsWith("en");

    function editLabel() {
        editingLabel.set(resourceKey);
    }

    function interpolate(
        formatter: MessageFormatter,
        { key, params, level, lowercase }: ResourceKey,
    ): string {
        if (level !== undefined) {
            const levelTxt = formatter(`level.${level}`);
            const p = params ?? {};
            return formatter(key, {
                values: { ...p, level: lowercase ? levelTxt.toLowerCase() : levelTxt },
            });
        } else {
            return formatter(key, { values: params });
        }
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
