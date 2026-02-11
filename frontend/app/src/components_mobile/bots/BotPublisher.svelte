<script lang="ts">
    import { Body, Column } from "component-lib";
    import { i18nKey, type ExternalBot } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import ChooseBot from "./ChooseBot.svelte";
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
    <Column padding={["zero", "md"]} gap={"lg"}>
        <Body>
            <Translatable resourceKey={i18nKey("proposal.maker.chooseBot")} />
        </Body>
        <ChooseBot ownedOnly onSelect={select} />
    </Column>
{:else}
    <BotProperties padded bot={selected} installing={false}></BotProperties>
{/if}
