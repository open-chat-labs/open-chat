<script lang="ts">
    import { ColourVars, Column, StatusCard } from "component-lib";
    import { botState, currentUserIdStore, type ExternalBot } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import BotMatch from "./BotMatch.svelte";

    interface Props {
        onSelect: (bot: ExternalBot) => void;
        ownedOnly: boolean;
    }

    let { onSelect, ownedOnly }: Props = $props();

    let bots = $derived(
        ownedOnly
            ? [...botState.externalBots.values()].filter((b) => b.ownerId === $currentUserIdStore)
            : [...botState.externalBots.values()],
    );
</script>

{#if bots.length === 0}
    <StatusCard borderColour={ColourVars.warning} mode={"warning"} title={"No bots available"}>
        {#snippet body()}
            <Translatable resourceKey={i18nKey("bots.update_bot.nobots")}></Translatable>
        {/snippet}
    </StatusCard>
{:else}
    <Column maxHeight={"30rem"} gap={"md"}>
        {#each bots as bot}
            <BotMatch {bot} {onSelect} />
        {/each}
    </Column>
{/if}
