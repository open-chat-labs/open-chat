<script lang="ts">
    import {
        Avatar,
        BodySmall,
        ColourVars,
        Column,
        IconButton,
        Row,
        Subtitle,
    } from "component-lib";
    import type { MessageContext, P2PSwapContentInitial } from "openchat-client";
    import { enhancedCryptoLookup, localUpdates } from "openchat-client";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import MulticolourText from "../MulticolourText.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    interface Props {
        content: P2PSwapContentInitial;
        messageContext: MessageContext;
    }

    let { content, messageContext }: Props = $props();

    let fromState = $derived(new TokenState($enhancedCryptoLookup.get(content.token0.ledger)!));
    let toState = $derived(new TokenState($enhancedCryptoLookup.get(content.token1.ledger)!));

    function removeDraft() {
        localUpdates.draftMessages.delete(messageContext);
    }
</script>

{#snippet token(label: string, state: TokenState, amount: bigint, showClose: boolean = false)}
    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        padding={["md", "lg", "md", "sm"]}
        borderRadius={"lg"}
        background={ColourVars.background1}>
        <Avatar size={"lg"} url={state.logo} />
        <Column>
            <Subtitle ellipsisTruncate fontWeight={"bold"}>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(label),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey(`${state.formatTokens(amount)} ${state.symbol}`),
                            colour: "primary",
                        },
                    ]} />
            </Subtitle>
            <BodySmall colour={"textSecondary"}>
                {`= ${state.formatConvertedTokens(amount)}`}
            </BodySmall>
        </Column>
        {#if showClose}
            <IconButton onclick={removeDraft}>
                {#snippet icon()}
                    <Close color={ColourVars.textSecondary} />
                {/snippet}
            </IconButton>
        {/if}
    </Row>
{/snippet}

<Column crossAxisAlignment={"center"} gap={"xs"}>
    {@render token("Swap ", fromState, content.token0Amount, true)}
    <Row
        supplementalClass={"swap_initial_down_arrow"}
        width={{ size: "2.5rem" }}
        height={{ size: "2.5rem" }}
        borderRadius={"circle"}
        borderWidth={"extraThick"}
        borderColour={ColourVars.background0}
        background={ColourVars.background1}
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}>
        <ArrowDown size={"1.2rem"} />
    </Row>
    {@render token("For ", toState, content.token1Amount)}
</Column>

<style lang="scss">
    :global(.container.swap_initial_down_arrow) {
        position: absolute;
        width: 2.5rem;
        height: 2.5rem;
        transform: translateY(3.5rem);
        z-index: 1;
    }
</style>
