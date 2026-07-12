<script lang="ts">
    import { i18nKey, type ExternalBot } from "@client";
    import Legend from "@src/desktop/shared/Legend.svelte";
    import ChooseBot from "./ChooseBot.svelte";
    import BotProperties from "@src/desktop/features/bots/install/BotProperties.svelte";

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
