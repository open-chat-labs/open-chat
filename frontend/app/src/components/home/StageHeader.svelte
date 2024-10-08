<script lang="ts">
    import { afterUpdate, createEventDispatcher } from "svelte";
    import { menuStore } from "../../stores/menu";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    const dispatch = createEventDispatcher();

    type Step = {
        key: string;
        labelKey: string;
        valid: boolean;
    };

    export let step: string;
    export let enabled: boolean;
    export let steps: Step[];

    afterUpdate(() => menuStore.hideMenu());

    function selectStep(key: string) {
        if (enabled) {
            dispatch("step", key);
        }
    }
</script>

<div class="steps" class:enabled>
    {#each steps as s}
        <div
            role="button"
            class:invalid={!s.valid}
            on:click={() => selectStep(s.key)}
            class:selected={step === s.key}
            class="step">
            <Translatable resourceKey={i18nKey(s.labelKey)} />
        </div>
    {/each}
</div>

<style lang="scss">
    .steps {
        display: flex;
        align-items: center;
        @include font(book, normal, fs-80);
        font-weight: 700;
        color: var(--txt-light);
        margin-bottom: $sp5;
        gap: $sp5;
        border-bottom: 1px solid var(--bd);

        @include mobile() {
            @include font(book, normal, fs-70);
            gap: $sp4;
        }

        .step {
            padding-bottom: 12px;
            margin-bottom: -2px;
            border-bottom: 4px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 4px solid var(--primary);
            }
            &.invalid::after {
                content: "!";
                color: var(--menu-warn);
            }
        }

        &.enabled {
            .step {
                cursor: pointer;
            }
        }
    }
</style>
