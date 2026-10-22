<script lang="ts">
    import { BRIDGE_PLATFORM_NAMES, type BridgePlatform } from "@client";
    import Robot from "svelte-material-icons/Robot.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import { BRIDGE_PLATFORM_ICONS } from "@src/utils/bridgedAccounts";

    interface Props {
        bot?: boolean;
        webhook?: boolean;
        // The platform a bridge bot relayed the message from, whose logo is shown in place of the bot
        // badge
        bridge?: BridgePlatform;
    }

    let { bot = false, webhook = false, bridge }: Props = $props();
</script>

{#if bridge !== undefined}
    <img
        class="bridge"
        src={BRIDGE_PLATFORM_ICONS[bridge]}
        alt={BRIDGE_PLATFORM_NAMES[bridge]}
        title={BRIDGE_PLATFORM_NAMES[bridge]} />
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
        flex: none;
        width: toRem(16);
        height: toRem(16);
    }
</style>
