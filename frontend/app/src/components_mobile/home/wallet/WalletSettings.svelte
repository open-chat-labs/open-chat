<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        Body,
        ColourVars,
        CommonButton,
        Container,
        Input,
        Label,
        Switch,
    } from "component-lib";
    import {
        cryptoTokensSorted as accountsSorted,
        cryptoLookup,
        OpenChat,
        pinNumberRequiredStore,
        walletConfigStore,
        type CryptocurrencyDetails,
        type EnhancedTokenDetails,
        type ReadonlyMap,
        type WalletConfig,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    const client = getContext<OpenChat>("client");

    let showTokenSelector = $state(false);
    let searchTerm = $state("");
    let searching = $state(false);
    let config: WalletConfig = $state({ ...$walletConfigStore });
    let valid = $derived(config.kind === "manual_wallet" || !isNaN(Number(config.minDollarValue)));
    let defaultLedgers = $derived(getDefaultLedgers($cryptoLookup));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let filteredTokens = $derived(
        $accountsSorted.filter(
            (token) =>
                searchTermLower === "" ||
                token.name.toLowerCase().includes(searchTermLower) ||
                token.symbol.toLowerCase().includes(searchTermLower),
        ),
    );

    function getDefaultLedgers(
        ledgerLookup: ReadonlyMap<string, CryptocurrencyDetails>,
    ): Set<string> {
        const lookup = [...ledgerLookup.entries()].reduce(
            (bySymbol, [k, v]) => {
                bySymbol[v.symbol] = k;
                return bySymbol;
            },
            {} as Record<string, string>,
        );
        // return new Set<string>(DEFAULT_TOKENS.map((t) => lookup[t]).filter((l) => l !== undefined));
        return new Set<string>(["chat"].map((t) => lookup[t]).filter((l) => l !== undefined));
    }

    function toggleMode() {
        if (config.kind === "auto_wallet") {
            selectMode("manual_wallet");
        } else {
            selectMode("auto_wallet");
        }
    }

    function clone(config: WalletConfig): WalletConfig {
        switch (config.kind) {
            case "auto_wallet":
                return { ...config };
            case "manual_wallet":
                return {
                    kind: "manual_wallet",
                    tokens: new Set(config.tokens),
                };
        }
    }

    onMount(() => {
        config = clone($walletConfigStore);

        return () => {
            console.log("On destroy - why is this running?");
            if (client.walletConfigChanged($walletConfigStore, config)) {
                client.setWalletConfig(config).then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(
                            i18nKey("cryptoAccount.configureWalletFailure"),
                        );
                    }
                });
            }
        };
    });

    function selectMode(kind: WalletConfig["kind"]) {
        switch (kind) {
            case "auto_wallet":
                config =
                    $walletConfigStore.kind === "auto_wallet"
                        ? $walletConfigStore
                        : { kind: "auto_wallet", minDollarValue: 0 };
                break;
            case "manual_wallet":
                config =
                    $walletConfigStore.kind === "manual_wallet"
                        ? $walletConfigStore
                        : { kind: "manual_wallet", tokens: defaultLedgers };
                break;
        }
    }

    function selectToken(token: EnhancedTokenDetails) {
        console.log("is this running", config);
        if (config.kind === "manual_wallet") {
            if (config.tokens.has(token.symbol)) {
                config.tokens.delete(token.symbol);
            } else {
                config.tokens.add(token.symbol);
            }
            config = { ...config };
        }
    }
</script>

<SlidingPageContent title={i18nKey("Wallet settings")}>
    <Container height={{ kind: "fill" }} gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
            <Setting
                toggle={() => console.log("toggle pin")}
                info={"Set a PIN number to add an extra layer of security to your wallet. You will be prompted to enter your pin before making any transactions."}>
                <Switch width={{ kind: "fill" }} reverse checked={$pinNumberRequiredStore ?? false}>
                    <Translatable resourceKey={i18nKey("PIN number")} />
                </Switch>
            </Setting>
            <Setting
                toggle={toggleMode}
                info={[
                    "When enabled, your wallet will be organised automatically, and any token with a non-zero balance, or with dollar value greater than the minimum provided, will be displayed.",
                    "Otherwise, you may configure your wallet manually, by selecting tokens which should appear in the wallet.",
                ]}>
                <Switch
                    onChange={toggleMode}
                    width={{ kind: "fill" }}
                    reverse
                    checked={config.kind === "auto_wallet"}>
                    <Translatable resourceKey={i18nKey("Automatic configuration")} />
                </Switch>
            </Setting>
        </Container>

        {#if config.kind === "auto_wallet"}
            <Input
                error={!valid}
                bind:value={config.minDollarValue}
                placeholder={interpolate($_, i18nKey("cryptoAccount.minDollarPlaceholder"))}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey(
                            "Tokens with dollar value lower than the one provided will be hidden from the wallet",
                        )} />
                {/snippet}
            </Input>
        {:else}
            <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
                <Container>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Selected tokens")} />
                    </Body>
                    <CommonButton
                        mode={"active"}
                        size={"small_text"}
                        onClick={() => (showTokenSelector = true)}>Configure</CommonButton>
                </Container>
                {@const tokens = config.tokens}
                {@const selected = $accountsSorted.filter((a) => tokens.has(a.symbol))}
                <Container wrap gap={"sm"}>
                    {#each selected as token}
                        {@render selectedToken(token)}
                    {/each}
                </Container>
            </Container>
        {/if}

        {#if config.kind === "manual_wallet"}
            {#if showTokenSelector}
                <TokenSelector
                    selected={config.tokens}
                    onSelect={selectToken}
                    placeholder={i18nKey("Filter tokens...")}
                    onDismiss={() => (showTokenSelector = false)}
                    title={i18nKey("Select tokens to view in wallet")} />
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

{#snippet selectedToken(token: EnhancedTokenDetails)}
    <Container
        supplementalClass={"user_chip"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        width={{ kind: "hug" }}
        gap={"md"}
        padding={["xs", "xs", "xs", "xs"]}
        borderColour={ColourVars.primary}
        borderRadius={"circle"}
        borderWidth={"thick"}
        onClick={() => selectedToken(token)}>
        <Avatar size={"xs"} url={token.logo}></Avatar>
        <Label colour={"primaryLight"} width={{ kind: "hug" }}>
            {token.symbol}
        </Label>
        <span class="icon">
            <Close color={ColourVars.primaryLight} />
        </span>
    </Container>
{/snippet}

<style lang="scss">
    .icon {
        display: flex;
    }
</style>
