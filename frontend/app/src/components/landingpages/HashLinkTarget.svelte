<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Copy from "svelte-material-icons/ContentCopy.svelte";
    const dispatch = createEventDispatcher();

    export let id: string;

    $: matches = [...id.matchAll(/(\d+-?)/g)];

    $: depth = matches.length;

    $: size = $mobileWidth ? "14px" : "16px";
</script>

<div class="wrapper">
    {#if depth === 1}
        <h2 class="link-target" {id}><slot /></h2>
    {:else if depth === 2}
        <h3 class="link-target" {id}><slot /></h3>
    {:else if depth === 3}
        <h4 class="link-target" {id}><slot /></h4>
    {:else if depth === 4}
        <h5 class="link-target" {id}><slot /></h5>
    {/if}
    <div class="copy" on:click={() => dispatch("copyUrl", id)}>
        <Copy {size} color={"var(--landing-txt)"} />
    </div>
</div>

<style lang="scss">
    :global(.link-target) {
        transition: color ease-in-out 300ms;
    }

    :global(.link-target.highlight) {
        color: var(--accent);
    }

    h2,
    h3,
    h4,
    h5 {
        margin: 0;
    }

    h2 {
        @include font(bold, normal, fs-160, 22);
    }

    h3 {
        @include font(bold, normal, fs-120, 22);
    }

    h4 {
        @include font(bold, normal, fs-100, 22);
    }

    h5 {
        @include font(bold, normal, fs-80, 22);
    }

    .wrapper {
        margin-top: $sp4;
        margin-bottom: $sp3;
        display: flex;
        align-items: center;
        gap: $sp3;

        .copy {
            cursor: pointer;
            opacity: 0;
            transition: opacity 250ms ease-in-out;
        }

        &:hover .copy {
            opacity: 1;
        }

        @include mobile() {
            margin-top: $sp4;
        }
    }
</style>
