<script lang="ts">
    import { BRIDGE_PLATFORM_NAMES, type BridgePlatform } from "@client";
    import Robot from "svelte-material-icons/Robot.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";

    interface Props {
        bot?: boolean;
        webhook?: boolean;
        // The platform a bridge bot relayed the message from, shown in place of the bot badge
        bridge?: BridgePlatform;
    }

    let { bot = false, webhook = false, bridge }: Props = $props();
</script>

{#if bridge !== undefined}
    <div class={`bridge ${bridge}`}>{BRIDGE_PLATFORM_NAMES[bridge]}</div>
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

    .bridge {
        border-radius: toRem(4);
        color: #ffffff;
        padding: 0 toRem(4);
        font-size: toRem(10);
        line-height: toRem(16);

        // Each platform's own brand colour
        &.discord {
            background-color: #5865f2;
        }

        &.telegram {
            background-color: #229ed9;
        }
    }
</style>
