<script lang="ts">
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import {
        DEFAULT_TOKENS,
        OpenChat,
        type CryptocurrencyDetails,
        type WalletConfig,
        walletConfigStore as walletConfig,
        cryptoTokensSorted as accountsSorted,
        cryptoLookup,
    } from "openchat-client";
    import Toggle from "../../Toggle.svelte";
    import Search from "../../Search.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";
    import { toastStore } from "../../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        conversionOptions: Option[];
        selectedConversion?: "none" | "usd" | "icp" | "btc" | "eth";
        onClose: () => void;
    }

    let { conversionOptions, selectedConversion = $bindable("none"), onClose }: Props = $props();

    let searchTerm = $state("");
    let searching = $state(false);

    let config: WalletConfig = $state({ ...$walletConfig });

    onMount(() => {
        config = clone($walletConfig);

        return () => {
            if (client.walletConfigChanged($walletConfig, config)) {
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

    function getDefaultLedgers(ledgerLookup: Record<string, CryptocurrencyDetails>): Set<string> {
        const lookup = Object.entries(ledgerLookup).reduce(
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
                    $walletConfig.kind === "auto_wallet"
                        ? $walletConfig
                        : { kind: "auto_wallet", minDollarValue: 0 };
                break;
            case "manual_wallet":
                config =
                    $walletConfig.kind === "manual_wallet"
                        ? $walletConfig
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

<Overlay {onClose}>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <div>
                <Translatable resourceKey={i18nKey("cryptoAccount.configureWallet")} />
            </div>
        {/snippet}
        {#snippet body()}
            <div>
                <div class="select-mode">
                    <div
                        onclick={() => selectMode("manual_wallet")}
                        class="mode-label"
                        class:selected={config.kind === "manual_wallet"}>
                        <Translatable resourceKey={i18nKey("cryptoAccount.manual")} />
                    </div>
                    <Toggle
                        checked={config.kind === "auto_wallet"}
                        on:change={toggleMode}
                        small
                        bottomMargin={false}
                        id={"wallet-mode-select"}></Toggle>
                    <div
                        onclick={() => selectMode("auto_wallet")}
                        class="mode-label"
                        class:selected={config.kind === "auto_wallet"}>
                        <Translatable resourceKey={i18nKey("cryptoAccount.auto")} />
                    </div>
                </div>
                {#if config.kind === "auto_wallet"}
                    <div class="auto-mode">
                        <div class="info">
                            <Translatable resourceKey={i18nKey("cryptoAccount.autoInfo")} />
                        </div>
                        <Legend label={i18nKey("cryptoAccount.minDollarPlaceholder")} />
                        <Input
                            invalid={!valid}
                            bind:value={config.minDollarValue}
                            placeholder={i18nKey("cryptoAccount.minDollarPlaceholder")} />
                    </div>
                {:else if config.kind === "manual_wallet"}
                    <div class="info">
                        <Translatable resourceKey={i18nKey("cryptoAccount.manualInfo")} />
                    </div>
                    <div class="token-selection">
                        <Search
                            fill
                            bind:searchTerm
                            bind:searching
                            placeholder={i18nKey("cryptoAccount.search")} />
                        <div class="token-header">
                            <Translatable resourceKey={i18nKey("cryptoAccount.token")} />
                            <MultiToggle
                                options={conversionOptions}
                                bind:selected={selectedConversion} />
                        </div>
                        <div class="tokens">
                            {#each filteredTokens as token}
                                <div class="token">
                                    <div class="token-details">
                                        <img
                                            alt={token.name}
                                            class:disabled={!token.enabled}
                                            class="icon"
                                            src={token.logo} />
                                        <div>
                                            {token.symbol}
                                        </div>
                                    </div>
                                    <BalanceWithRefresh
                                        ledger={token.ledger}
                                        value={token.balance}
                                        conversion={selectedConversion} />
                                    <Toggle
                                        checked={config.tokens.has(token.ledger)}
                                        on:change={() => toggle(token.ledger)}
                                        small
                                        bottomMargin={false}
                                        id={`token_${token.symbol}_toggle`}></Toggle>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .select-mode {
        display: flex;
        gap: $sp4;
        align-items: center;
        @include font(medium, normal, fs-120);
        margin-bottom: $sp4;

        .mode-label {
            cursor: pointer;
            color: var(--txt-light);

            &.selected {
                color: var(--txt);
            }
        }
    }

    .token-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        @include font(book, normal, fs-60);
        text-transform: uppercase;
    }

    .auto-mode {
        margin-bottom: 400px;
    }

    .token-selection {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .tokens {
        height: 400px;
        @include nice-scrollbar();
        flex: auto;
    }

    .token {
        display: flex;
        gap: $sp3;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp3;

        .token-details {
            display: flex;
            gap: $sp3;
            flex: auto;
        }

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
    }

    .info {
        @include font(light, normal, fs-70);
        margin-bottom: $sp4;
        color: var(--txt-light);
    }
</style>
