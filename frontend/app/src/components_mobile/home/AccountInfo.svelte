<script lang="ts">
    import { BodySmall, ColourVars, Container, Row, type Padding } from "component-lib";
    import { cryptoLookup, currentUserIdStore, currentUserStore, OpenChat } from "@client";
    import { ReceiveAccount } from "@src/logic/wallet/receiveAccount.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import QRCode from "../QRCode.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import NetworkSelector from "./NetworkSelector.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import RobotConfusedOutline from "svelte-material-icons/RobotConfusedOutline.svelte";
    import { Subtitle } from "component-lib";

    interface Props {
        ledger: string;
        padding?: Padding;
        background?: string;
    }

    let { ledger, padding = ["lg", "xl"], background = ColourVars.surface1 }: Props = $props();

    const client = getContext<OpenChat>("client");

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    // the networks, the address on the chosen one and what depositing there costs (ReceiveAccount,
    // shared with the desktop tree and the web wallet)
    const receive = new ReceiveAccount(
        client,
        () => tokenDetails,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );
    let networks = $derived(receive.networks);
    let selectedNetwork = $derived(receive.selectedNetwork);
    let account = $derived(receive.address);
    let note = $derived(receive.depositNote);

    let tokenName = $derived.by(() => {
        if (selectedNetwork === undefined) return tokenDetails.symbol;
        // BTC / ckBTC and SOL / ckSOL are named after the network
        const arriving = receive.arrivingToken(selectedNetwork);
        if (arriving !== undefined) return arriving;
        return $rtlStore
            ? `(${selectedNetwork}) ${tokenDetails.symbol}`
            : `${tokenDetails.symbol} (${selectedNetwork})`;
    });
</script>

{#snippet fetchingDepositFee()}
    <!-- TODO add loading spinner ? -->
    <Subtitle colour={"textSecondary"}>
        {$_("cryptoAccount.fetchingDepositFee")}
    </Subtitle>
{/snippet}

{#snippet fetchingFeeError()}
    <Subtitle colour={"validationError"}>
        {$_("cryptoAccount.failedToFetchDepositFee")}
    </Subtitle>
    <RobotConfusedOutline color={ColourVars.validationError} size="1.25rem" />
{/snippet}

<!-- TODO open fee breakdown modal -->
{#snippet displayFee(values: { amount: string; token: string })}
    <Subtitle colour={"validationWarning"}>
        {$_("cryptoAccount.networkFee", { values })}
    </Subtitle>
    <AlertCircleOutline color={ColourVars.validationWarning} size="1.25rem" />
{/snippet}

<Container gap={"xxs"} direction={"vertical"}>
    <Container
        borderRadius={["lg", "lg", "zero", "zero"]}
        {background}
        direction={"vertical"}
        {padding}>
        {#if account === undefined}
            <div class="generating">
                {#if receive.failed}
                    <div class="error-icon"></div>
                {:else}
                    <div class="spinner"></div>
                {/if}
            </div>
        {:else}
            <QRCode
                fullWidthOnMobile
                text={account}
                size={"larger"}
                logo={tokenDetails.logo}
                border={false} />
        {/if}
    </Container>

    {#if networks.length > 0 && selectedNetwork !== undefined}
        <NetworkSelector
            {background}
            {networks}
            flatSelect={true}
            bind:selectedNetwork={() => selectedNetwork, (v) => (receive.selectedNetwork = v)} />
    {/if}

    {#if note.kind === "loading"}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            {@render fetchingDepositFee()}
        </Row>
    {:else if note.kind === "failed"}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            {@render fetchingFeeError()}
        </Row>
    {:else if note.kind === "btc" || note.kind === "one_sec"}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            {@render displayFee({ amount: note.fee, token: tokenDetails.symbol })}
        </Row>
    {:else if note.kind === "sol"}
        {#if note.minimum !== undefined}
            <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
                <Subtitle colour={"textSecondary"}>
                    {$_("cryptoAccount.minimumDeposit", {
                        values: { amount: note.minimum, token: tokenDetails.symbol },
                    })}
                </Subtitle>
            </Row>
        {/if}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            <Subtitle colour={"validationWarning"}>
                {$_("cryptoAccount.solDepositFee", {
                    values: {
                        first: note.firstFee,
                        subsequent: note.laterFee,
                        token: tokenDetails.symbol,
                    },
                })}
            </Subtitle>
            <AlertCircleOutline color={ColourVars.validationWarning} size="1.25rem" />
        </Row>
    {/if}

    <Container
        {background}
        direction={"vertical"}
        padding={["lg", "xl"]}
        crossAxisAlignment="center"
        borderRadius={["zero", "zero", "lg", "lg"]}>
        {#if account === undefined}
            {#if receive.failed}
                <Subtitle colour={"validationError"}>
                    {$_("cryptoAccount.failedToGenerateAddress")}
                </Subtitle>
                <RobotConfusedOutline color={ColourVars.validationError} size="1.25rem" />
            {:else}
                <!-- TODO add spinner? -->
                <Subtitle colour={"textSecondary"}>
                    {$_("generating")}
                </Subtitle>
            {/if}
        {:else}
            <TruncatedAccount {account}>
                <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey("tokenTransfer.yourAccount", { token: tokenName })} />
                </BodySmall>
            </TruncatedAccount>
        {/if}
    </Container>
</Container>

<style lang="scss">
    .generating {
        height: 298px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        @include loading-spinner(4rem, 2rem, var(--button-spinner), "/assets/spinner.svg");
        flex: 0 0 toRem(24);
    }

    .error-icon {
        background-image: url("/assets/dead-bot.svg");
        height: 4rem;
        width: 4rem;
    }
</style>
