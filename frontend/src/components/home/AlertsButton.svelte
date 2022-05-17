<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import BellOutline from "svelte-material-icons/BellOutline.svelte";
    import { iconSize } from "../../stores/iconSize";

    export let unread: boolean = false;
</script>

<div class="alerts-button" class:unread on:click>
    <HoverIcon>
        <BellOutline size={$iconSize} color={"var(--icon-txt)"} />
        {#if unread}
            <div class="unread" />
        {/if}
    </HoverIcon>
</div>

<style type="text/scss">
    :global(.alerts-button.unread svg) {
        animation: ring 0.3s linear 2;
        transform-origin: top center;
    }
    $unread-offset: 12px;

    .alerts-button {
        position: relative;
        .unread {
            position: absolute;
            width: 7px;
            height: 7px;
            background-color: var(--error);
            border-radius: 50%;
            top: $unread-offset;
            right: $unread-offset;
        }
    }

    @keyframes ring {
        25% {
            transform: rotate(20deg);
        }
        50% {
            transform: rotate(0deg);
        }
        75% {
            transform: rotate(-20deg);
        }
        100% {
            transform: rotate(0deg);
        }
    }
</style>
