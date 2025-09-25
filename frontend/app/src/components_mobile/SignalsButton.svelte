<script lang="ts" module>
    let index = 0;
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import type { ButtonProps } from "./Button.svelte";

    let {
        cls = "",
        loading = false,
        disabled = false,
        secondary = false,
        small = false,
        tiny = false,
        fill = false,
        hollow = false,
        title = undefined,
        square = false,
        children,
        onClick,
    }: ButtonProps = $props();

    let colors = ["rgb(248, 255, 131)", "rgb(56, 183, 240)", "rgb(227, 26, 62)"];
    let color = $state("");

    onMount(() => {
        color = colors[index];
        index = (index + 1) % 3;
    });

    function click(e: MouseEvent) {
        if (onClick) {
            e.stopPropagation();
            onClick(e);
        }
    }
</script>

<button
    style={`--color: ${color}`}
    onclick={click}
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
    <div class:disabled class:loading class="fake-button">
        <div class="button-content">
            {#if !loading}
                {@render children?.()}
            {:else}
                {"Working ..."}
            {/if}
        </div>
    </div>
</button>

<style lang="scss">
    button {
        min-height: 45px;
        min-width: 150px;
        position: relative;
        z-index: 10;
        border-radius: 0;
        @include font(book, normal, fs-100, 20);
        border: none;
        background-color: var(--color);

        &.fill {
            width: 100%;
            height: 100%;
        }
    }

    .fake-button {
        position: absolute;
        cursor: pointer;
        width: 100%;
        height: 100%;
        margin-left: -4px;
        margin-top: -4px;
        top: 0;
        left: 0;
        background-color: white;
        border: 2px solid black;
        transition: transform 200ms ease-in-out;

        &:not(.disabled):hover {
            transform: translate(4px, 4px);
        }
    }

    button.fill .fake-button {
        margin-left: 0;
        margin-top: 0;
        &:hover {
            transform: none;
        }
    }

    .button-content {
        min-height: 45px;
        height: 100%;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        transform: translateY(-2px);
    }
</style>
