<script lang="ts">
    export let label: string;
    export let rules: string | undefined = undefined;
</script>

<div class="legend">
    <span class="label">{label}</span>
    {#if rules}
        <span class="rules">({rules})</span>
    {/if}
</div>

<style type="text/scss">
    .legend {
        margin-bottom: $sp2;

        .label {
            @include font(book, normal, fs-60);
        }
        .rules {
            @include font(light, normal, fs-60);
            color: var(--txt-light);
        }
    }
</style>
