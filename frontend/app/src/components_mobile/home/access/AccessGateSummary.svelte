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
        CommonButton,
        Row,
        Sheet,
    } from "component-lib";
    import {
        currentUserStore,
        enhancedCryptoLookup,
        OpenChat,
        type LeafGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountCheck from "svelte-material-icons/AccountCheckOutline.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import QrCode from "svelte-material-icons/QrCode.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateText from "../access_gates/AccessGateText.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { TokenState } from "../wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: LeafGate;
        onClick?: (g: LeafGate) => void;
    }

    let { gate, onClick }: Props = $props();
    let topup = $state<TokenState>();
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

{#snippet tokenGate(
    logo: string,
    symbol: string,
    insufficient: boolean,
    label: string,
    required: string,
    balance: string,
    supportsTopup: boolean = true,
)}
    <Row gap={"sm"}>
        <Row
            onClick={onClick && !insufficient ? () => onClick(gate) : undefined}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            background={insufficient ? ColourVars.background2 : undefined}
            gap={"md"}
            borderWidth={insufficient ? "zero" : "thick"}
            borderColour={insufficient ? undefined : ColourVars.primary}
            padding={["md", "lg"]}>
            <Avatar url={logo} />

            <Column width={"fill"}>
                <Row crossAxisAlignment={"center"} gap={"xs"}>
                    <Body
                        fontWeight={"bold"}
                        colour={insufficient ? "textSecondary" : "primary"}
                        width={"hug"}>{symbol}</Body>
                    <Body
                        fontWeight={"bold"}
                        colour={insufficient ? "textSecondary" : "textPrimary"}
                        width={"hug"}>{label}</Body>
                </Row>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {balance}
                </Caption>
            </Column>

            <Row width={"hug"}>
                <BodySmall colour={"textSecondary"}>
                    {required}
                </BodySmall>
            </Row>
        </Row>

        {#if insufficient && supportsTopup}
            <Column
                onClick={() => (topup = tokenState)}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                background={ColourVars.background2}
                width={{ size: "4rem" }}
                height={"fill"}
                borderRadius={"md"}
                padding={["sm", "md"]}>
                <QrCode size={"2rem"} color={ColourVars.textSecondary} />
            </Column>
        {/if}
    </Row>
{/snippet}

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "payment_gate" && tokenState}
        {@const insufficient = tokenState.cryptoBalance < gate.amount}
        {@render tokenGate(
            tokenState.logo,
            tokenState.symbol,
            insufficient,
            "payment gate",
            tokenState.formatTokens(gate.amount),
            tokenState.formattedTokenBalance,
        )}
    {:else if gate.kind === "token_balance_gate" && tokenState}
        {@const insufficient = tokenState.cryptoBalance < gate.minBalance}
        {@render tokenGate(
            tokenState.logo,
            tokenState.symbol,
            insufficient,
            "minimum balance gate",
            tokenState.formatTokens(gate.minBalance),
            tokenState.formattedTokenBalance,
        )}
    {:else if gate.kind === "chit_earned_gate"}
        {@const insufficient = $currentUserStore.totalChitEarned < gate.minEarned}
        {@render tokenGate(
            "/assets/chit.svg",
            "CHIT",
            insufficient,
            "earned gate",
            gate.minEarned.toLocaleString(),
            $currentUserStore.totalChitEarned.toLocaleString(),
            false,
        )}
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
    {:else if gate.kind === "unique_person_gate"}
        <Button onClick={onClick ? () => onClick(gate) : undefined}>
            {#snippet icon(color)}
                <AccountCheck {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Verify unique personhood")} />
        </Button>
    {:else}
        <AccessGateText {gate} />
    {/if}
{/if}

{#if topup !== undefined}
    <Sheet
        onDismiss={() => {
            topup?.refreshBalance(client);
            topup = undefined;
        }}>
        <Column gap={"xs"} padding={"xl"}>
            <AccountInfo
                background={ColourVars.background0}
                padding={"zero"}
                ledger={topup.ledger} />
            {@render refreshBalance(topup)}
        </Column>
    </Sheet>
{/if}

{#snippet refreshBalance(tokenState: TokenState)}
    <CommonButton
        width={"fill"}
        mode={"active"}
        size={"small_text"}
        onClick={() => tokenState.refreshBalance(client)}>
        {#snippet icon(color, size)}
            <Refresh {color} {size} />
        {/snippet}

        <Translatable resourceKey={i18nKey(`Refresh ${tokenState.symbol} balance`)} />
    </CommonButton>
{/snippet}
