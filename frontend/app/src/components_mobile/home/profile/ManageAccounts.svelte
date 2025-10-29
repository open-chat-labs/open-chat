<script lang="ts">
    import { BodySmall, Container, Search, Subtitle, Switch, Title } from "component-lib";
    import {
        cryptoTokensSorted as accountsSorted,
        cryptoLookup,
        DEFAULT_TOKENS,
        OpenChat,
        walletConfigStore,
        type CryptocurrencyDetails,
        type ReadonlyMap,
        type WalletConfig,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        conversionOptions: Option[];
        selectedConversion?: "none" | "usd" | "icp" | "btc" | "eth";
        onClose: () => void;
    }

    let { conversionOptions, selectedConversion = $bindable("none"), onClose }: Props = $props();

    let searchTerm = $state("");
    let searching = $state(false);

    let config: WalletConfig = $state({ ...$walletConfigStore });

    onMount(() => {
        config = clone($walletConfigStore);

        return () => {
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
        return new Set<string>(DEFAULT_TOKENS.map((t) => lookup[t]).filter((l) => l !== undefined));
    }

    function toggle(ledger: string) {
        if (config.kind === "manual_wallet") {
            if (config.tokens.has(ledger)) {
                config.tokens.delete(ledger);
            } else {
                config.tokens.add(ledger);
            }
            config = config;
        }
    }

    function toggleMode() {
        if (config.kind === "auto_wallet") {
            selectMode("manual_wallet");
        } else {
            selectMode("auto_wallet");
        }
    }

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
</script>

<Container
    height={{ kind: "hug" }}
    padding={["xl", "md", "xl", "md"]}
    gap={"xl"}
    direction={"vertical"}>
    <Container padding={["zero", "md"]} direction={"vertical"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("cryptoAccount.configureWallet")} />
        </Subtitle>
    </Container>

    <Container padding={["zero", "md"]} gap={"xl"}>
        <Title width={{ kind: "hug" }} onClick={() => selectMode("manual_wallet")} align={"end"}>
            <Translatable resourceKey={i18nKey("cryptoAccount.manual")} />
        </Title>
        <Switch checked={config.kind === "auto_wallet"} onChange={toggleMode} />
        <Title width={{ kind: "hug" }} onClick={() => selectMode("auto_wallet")} align={"start"}>
            <Translatable resourceKey={i18nKey("cryptoAccount.auto")} />
        </Title>
    </Container>
    {#if config.kind === "auto_wallet"}
        <Container padding={["zero", "md"]} gap={"md"} direction={"vertical"}>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("cryptoAccount.autoInfo")} />
            </BodySmall>
            <Legend label={i18nKey("cryptoAccount.minDollarPlaceholder")} />
            <Input
                invalid={!valid}
                bind:value={config.minDollarValue}
                placeholder={i18nKey("cryptoAccount.minDollarPlaceholder")} />
        </Container>
    {:else if config.kind === "manual_wallet"}
        <Container padding={["zero", "md"]} gap={"md"} direction={"vertical"}>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("cryptoAccount.manualInfo")} />
            </BodySmall>
        </Container>
        <Container direction={"vertical"}>
            <Search
                bind:value={searchTerm}
                bind:searching
                placeholder={interpolate($_, i18nKey("cryptoAccount.search"))} />
        </Container>
        <Container padding={["zero", "md"]} gap={"md"} direction={"vertical"}>
            <Container crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
                <BodySmall>
                    <Translatable resourceKey={i18nKey("cryptoAccount.token")} />
                </BodySmall>
                <MultiToggle options={conversionOptions} bind:selected={selectedConversion} />
            </Container>
            <Container gap={"md"} direction={"vertical"}>
                {#each filteredTokens as token}
                    <Container crossAxisAlignment={"center"} gap={"sm"}>
                        <Container crossAxisAlignment={"center"} gap={"sm"}>
                            <img
                                alt={token.name}
                                class:disabled={!token.enabled}
                                class="icon"
                                src={token.logo} />
                            <BodySmall>
                                {token.symbol}
                            </BodySmall>
                        </Container>
                        <BalanceWithRefresh
                            ledger={token.ledger}
                            value={token.balance}
                            allowCached={true}
                            conversion={selectedConversion} />
                        <Switch
                            checked={config.tokens.has(token.ledger)}
                            onChange={() => toggle(token.ledger)} />
                    </Container>
                {/each}
            </Container>
        </Container>
    {/if}
</Container>

<style lang="scss">
    .icon {
        background-size: contain;
        height: 24px;
        width: 24px;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;

        &.disabled {
            filter: grayscale(1);
        }
    }
</style>
