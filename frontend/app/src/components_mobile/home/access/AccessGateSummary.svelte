<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { accessApprovalState } from "@src/utils/preview.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Column,
        MenuItem,
        MenuTrigger,
        Row,
    } from "component-lib";
    import {
        type CryptocurrencyDetails,
        currentUserStore,
        enhancedCryptoLookup,
        type LeafGate,
        type NeuronGate,
        OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountCheck from "svelte-material-icons/AccountCheckOutline.svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateText from "../access_gates/AccessGateText.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import AccessGateBox from "./AccessGateBox.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: LeafGate;
        satisfied: boolean;
        onClick: (g: LeafGate) => void;
    }

    let { gate, onClick, satisfied }: Props = $props();
    let token = $derived(client.getTokenDetailsForAccessGate(gate));
    let tokenState = $derived.by(() => {
        switch (gate.kind) {
            case "token_balance_gate":
            case "payment_gate":
                return new TokenState($enhancedCryptoLookup.get(gate.ledgerCanister)!, "usd");
            default:
                return undefined;
        }
    });

    function neuronGateSubtext(gate: NeuronGate): string | undefined {
        const dissolveDelayDays = client.getMinDissolveDelayDays(gate);
        const minStake = client.getMinStakeInTokens(gate);
        const parts: string[] = [];
        if (dissolveDelayDays !== undefined) {
            parts.push(`${dissolveDelayDays}d dissolve delay`);
        }
        if (minStake !== undefined) {
            parts.push(`${minStake} token stake`);
        }
        return parts.join(" / ");
    }
</script>

{#snippet booleanGate(Icon: any, title: string, subtitle?: string)}
    <AccessGateBox {satisfied} satisfiable onClick={() => onClick(gate)}>
        <Row mainAxisAlignment={"center"} width={{ size: "2.5rem" }}>
            <Icon color={ColourVars.warning} size={"1.5rem"} />
        </Row>
        <Column>
            <Body fontWeight="bold" colour={"textPrimary"}>
                <Translatable resourceKey={i18nKey(title)} />
            </Body>
            {#if subtitle !== undefined}
                <Caption colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey(subtitle)} />
                </Caption>
            {/if}
        </Column>
    </AccessGateBox>
{/snippet}

{#snippet neuronGate(gate: NeuronGate, token: CryptocurrencyDetails)}
    {@const subtext = neuronGateSubtext(gate)}
    <AccessGateBox {satisfied} satisfiable onClick={() => onClick(gate)}>
        <Avatar url={token.logo} />

        <Column width={"fill"}>
            <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}>{token.name}</Body>
            {#if subtext !== undefined}
                <Caption colour={"textSecondary"}>
                    {subtext}
                </Caption>
            {/if}
        </Column>
    </AccessGateBox>
{/snippet}

{#snippet tokenGate(
    logo: string,
    symbol: string,
    insufficient: boolean,
    label: string,
    required: string,
    balance: string,
    onClick?: () => void,
    refresh?: () => void,
)}
    <MenuTrigger maskUI align={"end"} position={"bottom"} fill mobileMode={"longpress"}>
        {#snippet menuItems()}
            <MenuItem onclick={refresh}>
                <Translatable resourceKey={i18nKey("Refresh balance")} />
            </MenuItem>
        {/snippet}
        <AccessGateBox {satisfied} satisfiable={!insufficient} {onClick}>
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
                <Caption colour={insufficient ? "error" : "textSecondary"}>
                    {balance}
                    {#if insufficient}
                        {`/ Insufficient ${symbol}`}
                    {/if}
                </Caption>
            </Column>

            <Row width={"hug"}>
                <BodySmall colour={"textSecondary"}>
                    {required}
                </BodySmall>
            </Row>
        </AccessGateBox>
    </MenuTrigger>
{/snippet}

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "payment_gate" && tokenState}
        {@const balance = accessApprovalState.balanceAfterCurrentCommitments(
            tokenState.ledger,
            tokenState.cryptoBalance,
        )}
        {@const insufficient = balance < gate.amount && !satisfied}
        {@render tokenGate(
            tokenState.logo,
            tokenState.symbol,
            insufficient,
            "payment gate",
            tokenState.formatTokens(gate.amount),
            tokenState.formatTokens(balance),
            () => onClick(gate),
            () => tokenState.refreshBalance(client),
        )}
    {:else if gate.kind === "token_balance_gate" && tokenState}
        {@const balance = accessApprovalState.balanceAfterCurrentCommitments(
            tokenState.ledger,
            tokenState.cryptoBalance,
        )}
        {@const insufficient = balance < gate.minBalance}
        {@render tokenGate(
            tokenState.logo,
            tokenState.symbol,
            insufficient,
            "minimum balance gate",
            tokenState.formatTokens(gate.minBalance),
            tokenState.formatTokens(balance),
            () => onClick(gate),
            () => tokenState.refreshBalance(client),
        )}
    {:else if gate.kind === "neuron_gate" && token}
        {@render neuronGate(gate, token)}
    {:else if gate.kind === "chit_earned_gate"}
        {@const insufficient = $currentUserStore.totalChitEarned < gate.minEarned}
        {@render tokenGate(
            "/assets/chit.svg",
            "CHIT",
            insufficient,
            "earned gate",
            gate.minEarned.toLocaleString(),
            $currentUserStore.totalChitEarned.toLocaleString(),
        )}
    {:else if gate.kind === "lifetime_diamond_gate"}
        {@render booleanGate(
            Lifetime,
            satisfied ? "Lifetime diamond membership" : "Get lifetime membership",
            satisfied ? undefined : "You are currently not a member",
        )}
    {:else if gate.kind === "diamond_gate"}
        {@render booleanGate(
            Diamond,
            satisfied ? "Diamond membership" : "Get diamond membership",
            satisfied ? undefined : "You are currently not a member",
        )}
    {:else if gate.kind === "unique_person_gate"}
        {@render booleanGate(
            AccountCheck,
            satisfied ? "Unique personhood verified" : "Verify unique personhood",
            satisfied ? undefined : "You have not yet been verified",
        )}
    {:else}
        <AccessGateText {gate} />
    {/if}
{/if}
