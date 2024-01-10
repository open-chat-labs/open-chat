<script lang="ts">
    import type { ResourceKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    export let label: ResourceKey;
    export let rules: ResourceKey | undefined = undefined;
    export let required = false;
</script>

<div class="legend">
    <span class="label"><Translatable resourceKey={label} /></span>
    {#if rules}
        <span class="rules">(<Translatable resourceKey={rules} />)</span>
    {/if}
    {#if required}
        <span class="required">*</span>
    {/if}
</div>

<style lang="scss">
    .legend {
        margin-bottom: $sp2;

        .label {
            @include font(book, normal, fs-60);
        }
        .rules {
            @include font(light, normal, fs-60);
            color: var(--txt-light);
        }
        .required {
            color: var(--accent);
        }
    }
</style>
