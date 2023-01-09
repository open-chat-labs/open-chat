<script lang="ts">
    export let label: string;
    export let required: boolean = false;
</script>

<div class="field">
    <label>
        {label}
        {#if required}
            <span class="required">*</span>
        {/if}
    </label>
    <slot />
</div>

<style type="text/scss">
    .field {
        margin-bottom: $sp5;
    }
    label {
        @include font(bold, normal, fs-100, 22);
        display: inline-block;
        margin-bottom: $sp2;
    }
    .required {
        color: var(--accent);
    }
</style>
