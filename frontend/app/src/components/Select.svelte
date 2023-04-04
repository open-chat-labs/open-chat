<script lang="ts">
    export let value: unknown = "";
    export let invalid: boolean = false;
    export let disabled: boolean = false;
    export let margin: boolean = true;
</script>

<select class:invalid class:margin {disabled} bind:value class={`select`} on:change>
    <slot />
</select>

<style type="text/scss">
    :global(option) {
        color: var(--txt);
    }

    .select {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;
        line-height: 24px;
        padding: $sp3;
        @include font(book, normal, fs-100);
        color: var(--txt);
        background-color: var(--input-bg);
        border: 1px solid var(--bd);
        outline: none;
        border-radius: $sp2;

        &.margin {
            margin-bottom: $sp4;
        }

        &.invalid {
            border: 1px solid var(--error);
            box-shadow: 0 0 5px 1px var(--error);
        }
    }
</style>
