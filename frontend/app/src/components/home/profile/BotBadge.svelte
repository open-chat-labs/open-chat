<script lang="ts">
    import Robot from "svelte-material-icons/Robot.svelte";

    interface Props {
        bot?: boolean;
    }

    let { bot = false }: Props = $props();
</script>

{#if bot}
    <div class="robot">
        <Robot viewBox={"0 2 24 24"} size={"0.8em"} color={"rgba(255,255,255,0.9)"} />
    </div>
{/if}

<style lang="scss">
    .robot {
        border-radius: 50%;
        background-color: var(--accent);
        padding: toRem(3);
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
