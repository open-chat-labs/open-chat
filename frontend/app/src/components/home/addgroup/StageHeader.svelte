<script lang="ts">
    export let step: number;
</script>

<div class="steps">
    <div class:selected={step === 0} class="step">Details</div>
    <div class:selected={step === 1} class="step">Visibility</div>
    <div class:selected={step === 2} class="step">Group rules</div>
    <div class:selected={step === 3} class="step">Permissions</div>
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
    }

    .step {
        padding-bottom: 12px;
        margin-bottom: -2px;
        border-bottom: 4px solid transparent;
        &.selected {
            color: var(--txt);
            border-bottom: 4px solid var(--primary);
        }
    }
</style>
