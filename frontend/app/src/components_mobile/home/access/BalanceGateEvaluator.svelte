<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { accessApprovalState } from "@src/utils/preview.svelte";
    import {
        Avatar,
        Body,
        Caption,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        Sheet,
        StatusCard,
    } from "component-lib";
    import { enhancedCryptoLookup, publish, type TokenBalanceGate } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Chart from "svelte-material-icons/ChartBoxOutline.svelte";
    import QrCode from "svelte-material-icons/QrCode.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    interface Props {
        gate: TokenBalanceGate & { expiry: bigint | undefined };
        onClose: () => void;
    }

    let { gate, onClose }: Props = $props();

    let tokenState = $derived(new TokenState($enhancedCryptoLookup.get(gate.ledgerCanister)!));
    let cryptoBalance = $derived(
        accessApprovalState.balanceAfterCurrentCommitments(
            tokenState.ledger,
            tokenState.cryptoBalance,
        ),
    );

    function topup() {
        publish("receiveToken", tokenState);
        onClose();
    }
</script>

{#snippet tokenBalance()}
    <Row gap={"sm"}>
        <Row
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            minHeight={"4rem"}
            gap={"md"}
            background={ColourVars.background2}
            padding={["md", "lg"]}>
            <Avatar url={tokenState.logo} />
            <Column width={"fill"}>
                <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}
                    >{tokenState.symbol}</Body>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {tokenState.formatTokens(cryptoBalance)}
                </Caption>
            </Column>
        </Row>
        <Column
            onClick={topup}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}
            width={{ size: "4rem" }}
            height={"fill"}
            borderRadius={"lg"}
            background={ColourVars.background2}
            padding={["sm", "md"]}>
            <QrCode size={"2rem"} color={ColourVars.textSecondary} />
        </Column>
    </Row>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column padding={"xl"} gap={"xl"}>
        <Chart color={ColourVars.primary} size={"4rem"} />
        <H2 fontWeight={"bold"}>
            <MulticolourText
                parts={[
                    {
                        text: i18nKey("Minimum "),
                        colour: "textPrimary",
                    },
                    {
                        text: i18nKey(tokenState.symbol),
                        colour: "primary",
                    },
                    {
                        text: i18nKey(" balance"),
                        colour: "textPrimary",
                    },
                ]} />
        </H2>

        <Column gap={"sm"}>
            <StatusCard
                borderColour={ColourVars.background2}
                background={ColourVars.background0}
                mode={"warning"}
                body={interpolate(
                    $_,
                    i18nKey(
                        `To satisfy the minimum ${tokenState.symbol} balance gate you need to hold a specified amount of the token in your wallet. Top up your ${tokenState.symbol} token account, tap the QR code button to get your receiving address.`,
                    ),
                )}
                title={interpolate($_, i18nKey("Insufficient funds"))}>
            </StatusCard>
            {#if gate.expiry !== undefined}
                <StatusCard
                    background={ColourVars.background2}
                    mode={"information"}
                    title={interpolate($_, i18nKey("This is a recurring check"))}>
                    {#snippet body()}
                        <AccessGateExpiry expiry={gate.expiry} />
                    {/snippet}
                </StatusCard>
            {/if}
            {@render tokenBalance()}
        </Column>
    </Column>
    <CommonButton mode={"active"} width={"fill"} size={"small_text"} onClick={onClose}>
        <Translatable resourceKey={i18nKey("cancel")} />
    </CommonButton>
</Sheet>
