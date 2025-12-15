<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        Column,
        Row,
    } from "component-lib";
    import { enhancedCryptoLookup, type LeafGate } from "openchat-client";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateText from "../access_gates/AccessGateText.svelte";
    import { TokenState } from "../wallet/walletState.svelte";

    interface Props {
        gate: LeafGate;
        onClick?: (g: LeafGate) => void;
    }

    let { gate, onClick }: Props = $props();
    let tokenState = $derived.by(() => {
        switch (gate.kind) {
            case "token_balance_gate":
            case "payment_gate":
                return new TokenState($enhancedCryptoLookup.get(gate.ledgerCanister)!, "usd");
            default:
                return undefined;
        }
    });
</script>

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "payment_gate" && tokenState}
        <Row
            onClick={onClick ? () => onClick(gate) : undefined}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            gap={"md"}
            borderWidth={"thick"}
            borderColour={ColourVars.primary}
            padding={["md", "lg"]}>
            <Avatar url={tokenState.logo} />

            <Column width={"fill"}>
                <Row crossAxisAlignment={"center"} gap={"xs"}>
                    <Body fontWeight={"bold"} colour={"primary"} width={"hug"}
                        >{tokenState.symbol}</Body>
                    <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}
                        >payment gate</Body>
                </Row>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {tokenState.formattedTokenBalance}
                </Caption>
            </Column>

            <Row width={"hug"}>
                <BodySmall colour={"textSecondary"}>
                    {tokenState.formatTokens(gate.amount)}
                </BodySmall>
            </Row>
        </Row>
    {:else if gate.kind === "token_balance_gate" && tokenState}
        <Row
            onClick={onClick ? () => onClick(gate) : undefined}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            gap={"md"}
            borderWidth={"thick"}
            borderColour={ColourVars.primary}
            padding={["md", "lg"]}>
            <Avatar url={tokenState.logo} />

            <Column width={"fill"}>
                <Row crossAxisAlignment={"center"} gap={"xs"}>
                    <Body fontWeight={"bold"} colour={"primary"} width={"hug"}
                        >{tokenState.symbol}</Body>
                    <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}
                        >minimum balance gate</Body>
                </Row>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {tokenState.formattedTokenBalance}
                </Caption>
            </Column>

            <Row width={"hug"}>
                <BodySmall colour={"textSecondary"}>
                    {tokenState.formatTokens(gate.minBalance)}
                </BodySmall>
            </Row>
        </Row>
    {:else if gate.kind === "lifetime_diamond_gate"}
        <Button onClick={onClick ? () => onClick(gate) : undefined}>
            {#snippet icon(color)}
                <Lifetime {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Get lifetime membership")} />
        </Button>
    {:else if gate.kind === "diamond_gate"}
        <Button onClick={onClick ? () => onClick(gate) : undefined}>
            {#snippet icon(color)}
                <Diamond {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Get diamond membership")} />
        </Button>
    {:else}
        <AccessGateText {gate} />
    {/if}
{/if}
