<script lang="ts">
    export let value: string = "";
    let select: HTMLSelectElement;
</script>

<select bind:value bind:this={select} class={`select`}>
    <slot />
</select>

<style type="text/scss">
    @import "../styles/mixins";

    :global(option) {
        color: var(--input-txt);
    }

    .select {
        display: block;
        width: 100%;
        height: 40px;
        line-height: 24px;
        padding: $sp1 $sp3;
        @include font(book, normal, fs-100);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        outline: none;
        border-radius: $sp2;
        margin-bottom: $sp5;
    }
</style>
