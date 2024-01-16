<script lang="ts">
    import Translate from "svelte-material-icons/Translate.svelte";

    import { _, locale, dictionary } from "svelte-i18n";
    import { editmode, editingLabel, type ResourceKey, interpolate } from "../i18n/i18n";

    interface LocaleDictionary {
        [key: string]: LocaleDictionary | string | Array<string | LocaleDictionary> | null;
    }
    type LocalesDictionary = {
        [key: string]: LocaleDictionary | null;
    };

    export let resourceKey: ResourceKey;

    $: editable =
        $editmode && !$locale?.startsWith("en") && translatable($dictionary, $locale, resourceKey);

    /**
     * We need to make sure that only keys that actually exist in the dictionary are considered translatable
     * - this is a bit horrible but it will *only* run if we are in edit mode && the locale is not english
     */
    function translatable(
        dictionary: LocalesDictionary,
        locale: string | null | undefined,
        { key }: ResourceKey,
    ): boolean {
        if (!locale) return false;
        const localeValues = dictionary[locale];

        if (!localeValues) return false;

        if (key in localeValues) return true;

        const keys = key.split(".");
        let result: any = localeValues;

        for (const key of keys) {
            const val = result[key];
            if (val == null) {
                return false;
            } else {
                result = val;
            }
        }
        return result !== undefined;
    }

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
