<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let step: number;
    export let enabled: boolean;
    export let steps: string[];

    function selectStep(n: number) {
        if (enabled) {
            dispatch("step", n);
        }
    }
</script>

<div class="steps" class:enabled>
    {#each steps as s, i}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div on:click={() => selectStep(i)} class:selected={step === i} class="step">
            {$_(s)}
        </div>
    {/each}
</div>

<style type="text/scss">
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
        }

        &.enabled {
            .step {
                cursor: pointer;
            }
        }
    }
</style>
