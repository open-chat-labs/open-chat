<script lang="ts">
    import { Body, BodySmall, ColourVars, Container, Row, type Padding } from "component-lib";
    import {
        BTC_SYMBOL,
        CKBTC_SYMBOL,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        ICP_SYMBOL,
        Lazy,
        OpenChat,
        type OneSecTransferFees,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import QRCode from "../QRCode.svelte";
    import Translatable from "../Translatable.svelte";
    import NetworkSelector from "./NetworkSelector.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import RobotConfusedOutline from "svelte-material-icons/RobotConfusedOutline.svelte";

    interface Props {
        ledger: string;
        padding?: Padding;
        background?: string;
    }

    let { ledger, padding = ["lg", "xl"], background = ColourVars.background1 }: Props = $props();

    const client = getContext<OpenChat>("client");

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let selectedNetwork = $state<string>();
    let isBtc = $derived(tokenDetails.symbol === BTC_SYMBOL);
    let isBtcNetwork = $derived(selectedNetwork === BTC_SYMBOL);
    let oneSecEnabled = $derived(
        tokenDetails.oneSecEnabled && tokenDetails.evmContractAddresses.length > 0,
    );
    let isOneSecNetwork = $derived(oneSecEnabled && selectedNetwork !== ICP_SYMBOL);
    let networks = $derived.by(() => {
        if (isBtc) {
            return [BTC_SYMBOL, CKBTC_SYMBOL];
        } else if (oneSecEnabled) {
            return client.oneSecGetNetworks(tokenDetails.symbol);
        } else {
            return [];
        }
    });
    let btcAddress = $state<string>();
    let oneSecAddress = $state<string>();

    // Whenever the networks list changes, autoselect the first one
    $effect(() => {
        selectedNetwork = networks[0];
    });

    let account = $derived.by(() => {
        if (tokenDetails.symbol === ICP_SYMBOL) {
            return $currentUserStore.cryptoAccount;
        } else if (isBtcNetwork) {
            return btcAddress;
        } else if (isOneSecNetwork) {
            return oneSecAddress;
        } else {
            return $currentUserIdStore;
        }
    });

    let error = $state();
    $effect(() => {
        if (account === undefined) {
            if (isBtcNetwork) {
                client
                    .getBtcAddress()
                    .then((addr) => (btcAddress = addr))
                    .catch((e) => (error = e));
            } else if (isOneSecNetwork) {
                client
                    .getOneSecAddress()
                    .then((addr) => (oneSecAddress = addr))
                    .catch((e) => (error = e));
            }
        }
    });

    let tokenName = $derived.by(() => {
        if (isBtc) return selectedNetwork;
        if (selectedNetwork !== undefined) {
            return $rtlStore
                ? `(${selectedNetwork}) ${tokenDetails.symbol}`
                : `${tokenDetails.symbol} (${selectedNetwork})`;
        }
        return tokenDetails.symbol;
    });

    const btcDepositFeePromise = new Lazy(() =>
        client
            .getCkbtcMinterDepositInfo()
            .then((depositInfo) => `~${client.formatTokens(depositInfo.depositFee, 8)}`),
    );

    const oneSecFeesPromise = new Lazy(() =>
        client
            .oneSecGetTransferFees()
            // Filter to where source token equals destination token since we're dealing with cross-chain deposits
            .then(
                (fees) => (oneSecFees = fees.filter((f) => f.sourceToken === f.destinationToken)),
            ),
    );

    let oneSecFees = $state<OneSecTransferFees[]>();
    let oneSecFeesForToken = $derived.by(() => {
        if (!isOneSecNetwork || oneSecFees === undefined) return undefined;
        return oneSecFees.filter((f) => f.sourceToken === tokenDetails.symbol);
    });
    let oneSecProtocolFee = $derived.by(() => {
        if (oneSecFeesForToken === undefined) return undefined;
        return oneSecFeesForToken.find(
            (f) => f.sourceChain === selectedNetwork && f.destinationChain === ICP_SYMBOL,
        )?.protocolFeePercent;
    });
    let oneSecTransferFee = $derived.by(() => {
        if (oneSecFeesForToken === undefined) return undefined;
        return oneSecFeesForToken.find(
            (f) => f.sourceChain === ICP_SYMBOL && f.destinationChain === selectedNetwork,
        )?.latestTransferFee;
    });
    let oneSecTotalFee = $derived.by(() => {
        if (oneSecProtocolFee === undefined || oneSecTransferFee === undefined) return undefined;
        return `${oneSecProtocolFee}% + ~${client.formatTokens(
            oneSecTransferFee,
            tokenDetails.decimals,
        )}`;
    });
</script>

{#snippet fetchingDepositFee()}
    <!-- TODO add loading spinner ? -->
    <Body colour={"textSecondary"}>
        {$_("cryptoAccount.fetchingDepositFee")}
    </Body>
{/snippet}

{#snippet fetchingFeeError()}
    <Body colour={"error"}>
        {$_("cryptoAccount.failedToFetchDepositFee")}
    </Body>
    <RobotConfusedOutline color={ColourVars.error} size="1.25rem" />
{/snippet}

{#snippet displayFee(values: { amount: string; token: string })}
    <Body colour={"warning"}>
        {$_("cryptoAccount.networkFee", { values })}
    </Body>
    <AlertCircleOutline color={ColourVars.warning} size="1.25rem" />
{/snippet}

<Container gap={"xxs"} direction={"vertical"}>
    <Container
        borderRadius={["lg", "lg", "zero", "zero"]}
        {background}
        direction={"vertical"}
        {padding}>
        {#if account === undefined}
            <div class="generating">
                {#if error !== undefined}
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

    {#if isBtcNetwork}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            {#await btcDepositFeePromise.get()}
                {@render fetchingDepositFee()}
            {:then amount}
                {@render displayFee({ amount, token: tokenDetails.symbol })}
            {:catch}
                {@render fetchingFeeError()}
            {/await}
        </Row>
    {:else if isOneSecNetwork}
        <Row {background} padding={["lg", "xl"]} crossAxisAlignment="center">
            {#await oneSecFeesPromise.get()}
                {@render fetchingDepositFee()}
            {:then}
                {#if oneSecTotalFee !== undefined}
                    {@render displayFee({ amount: oneSecTotalFee, token: tokenDetails.symbol })}
                {:else}
                    {@render fetchingFeeError()}
                {/if}
            {:catch}
                {@render fetchingFeeError()}
            {/await}
        </Row>
    {/if}

    <Container
        {background}
        direction={"vertical"}
        padding={["lg", "xl"]}
        crossAxisAlignment="center"
        borderRadius={["zero", "zero", "lg", "lg"]}>
        {#if account === undefined}
            {#if error !== undefined}
                <Body colour={"error"}>
                    {$_("cryptoAccount.failedToGenera4teAddress")}
                </Body>
                <RobotConfusedOutline color={ColourVars.error} size="1.25rem" />
            {:else}
                <!-- TODO add spinner? -->
                <Body colour={"textSecondary"}>
                    {$_("generating")}
                </Body>
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

    {#if networks.length > 0 && selectedNetwork !== undefined}
        <Row padding={["lg", "zero"]}>
            <NetworkSelector {networks} bind:selectedNetwork />
        </Row>
    {/if}
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
