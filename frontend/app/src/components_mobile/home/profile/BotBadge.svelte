<script lang="ts">
    import Robot from "svelte-material-icons/Robot.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";

    interface Props {
        bot?: boolean;
        webhook?: boolean;
        // A message the Discord bot relayed from Discord, shown in place of the bot badge
        discord?: boolean;
    }

    let { bot = false, webhook = false, discord = false }: Props = $props();
</script>

{#if discord}
    <div class="discord">Discord</div>
{:else if bot}
    <div class="robot">
        <Robot viewBox={"0 2 24 24"} size={"0.8em"} color={"rgba(255,255,255,0.9)"} />
    </div>
{/if}
{#if webhook}
    <div class="robot">
        <Webhook viewBox={"0 2 24 24"} size={"0.8em"} color={"rgba(255,255,255,0.9)"} />
    </div>
{/if}

<style lang="scss">
    .robot {
        border-radius: 50%;
        background-color: var(--primary);
        padding: toRem(3);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .discord {
        border-radius: toRem(4);
        // Discord's own blurple
        background-color: #5865f2;
        color: #ffffff;
        padding: 0 toRem(4);
        font-size: toRem(10);
        line-height: toRem(16);
    }
</style>
