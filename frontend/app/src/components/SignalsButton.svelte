<script lang="ts" context="module">
    let index = 0;
</script>

<script lang="ts">
    import { onMount } from "svelte";

    export let cls = "";
    export let loading: boolean = false;
    export let disabled: boolean = false;
    export let secondary: boolean = false;
    export let small: boolean = false;
    export let tiny: boolean = false;
    export let fill: boolean = false;
    export let hollow: boolean = false;
    export let title: string | undefined = undefined;
    export let square: boolean = false;

    let colors = ["rgb(248, 255, 131)", "rgb(56, 183, 240)", "rgb(227, 26, 62)"];
    let color = "";

    onMount(() => {
        color = colors[index];
        index = (index + 1) % 3;
    });
</script>

<button
    style={`--color: ${color}`}
    class={cls}
    class:loading
    class:disabled
    class:small
    class:tiny
    class:hollow
    {disabled}
    class:secondary
    class:square
    {title}
    class:fill>
    <div role="button" tabindex="0" on:click|stopPropagation class="fake-button">
        <div class="content">
            {#if !loading}
                <slot />
            {/if}
        </div>
    </div>
</button>

<!-- <button
    on:click|stopPropagation
    class={cls}
    class:loading
    class:disabled
    class:small
    class:tiny
    class:hollow
    {disabled}
    class:secondary
    class:square
    {title}
    class:fill>
    {#if !loading}
        <slot />
    {/if}
</button> -->

<style lang="scss">
    button {
        border: none;
        background-color: var(--color);
        border: none;
        min-height: 45px;
        position: relative;
        min-width: 150px;
        @include font(book, normal, fs-100, 20);
        text-shadow: var(--button-txt-sh);
        cursor: pointer;

        &.fill {
            width: 100%;
            height: 100%;
        }
    }

    .fake-button {
        background-color: white;
        margin-top: -0.25rem;
        margin-left: -0.25rem;
        top: 0;
        border: var(--bw) solid black;
        position: absolute;
        width: 100%;
        height: 100%;
        transition: transform 200ms ease-in-out;
        cursor: pointer;

        &:hover {
            transform: translate(0.25rem, 0.25rem);
        }
    }

    .content {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 2.5rem;
        text-align: center;
    }
</style>
