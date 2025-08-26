<script lang="ts">
    import { i18nKey, type ExternalBot } from "openchat-client";
    import ChooseBot from "./ChooseBot.svelte";
    import Legend from "../Legend.svelte";
    import BotProperties from "./install/BotProperties.svelte";

    interface Props {
        selected: ExternalBot | undefined;
    }

    let { selected = $bindable() }: Props = $props();

    function select(bot: ExternalBot) {
        selected = bot;
    }
</script>

{#if selected === undefined}
    <Legend large label={i18nKey("proposal.maker.chooseBot")} />
    <ChooseBot ownedOnly onSelect={select} />
{:else}
    <BotProperties padded bot={selected} installing={false}></BotProperties>
{/if}

<style lang="scss">
</style>
