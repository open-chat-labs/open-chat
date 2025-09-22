<script lang="ts">
    import Translatable from "./Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    interface Props {
        label: ResourceKey;
        rules?: ResourceKey | undefined;
        required?: boolean;
        large?: boolean;
    }

    let { label, rules = undefined, required = false, large = false }: Props = $props();
</script>

<div class="legend">
    <span class="label" class:large><Translatable resourceKey={label} /></span>
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

            &.large {
                @include font(book, normal, fs-100);
            }
        }
        .rules {
            @include font(light, normal, fs-60);
            color: var(--txt-light);
        }
        .required {
            color: var(--error);
        }
    }
</style>
