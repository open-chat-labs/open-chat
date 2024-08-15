<script lang="ts">
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import { DEFAULT_TOKENS, OpenChat, type WalletConfig } from "openchat-client";
    import Toggle from "../../Toggle.svelte";
    import Search from "../../Search.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";

    const client = getContext<OpenChat>("client");

    export let conversionOptions: Option[];
    export let selectedConversion: "none" | "usd" | "icp" | "btc" | "eth" = "none";

    let searchTerm = "";
    let searching = false;

    $: valid = config.kind === "manual_wallet" || !isNaN(Number(config.minDollarValue));
    $: walletConfig = client.walletConfigStore;
    $: accountsSorted = client.cryptoTokensSorted;
    $: searchTermLower = searchTerm.toLowerCase();
    $: filteredTokens = $accountsSorted.filter(
        (token) =>
            searchTermLower === "" ||
            token.name.toLowerCase().startsWith(searchTermLower) ||
            token.symbol.toLowerCase().startsWith(searchTermLower),
    );

    $: console.log("Wallet config: ", $walletConfig);

    let config: WalletConfig = { ...$walletConfig };

    onMount(() => {
        config = { ...$walletConfig };

        return () => {
            client.setWalletConfig(config);
        };
    });

    function toggle(symbol: string) {
        if (config.kind === "manual_wallet") {
            if (config.tokens.has(symbol)) {
                config.tokens.delete(symbol);
            } else {
                config.tokens.add(symbol);
            }
            config = config;
        }
    }

    function toggleMode() {
        if (config.kind === "auto_wallet") {
            config = { kind: "manual_wallet", tokens: new Set(DEFAULT_TOKENS) };
        } else {
            config = { kind: "auto_wallet", minDollarValue: 1 };
        }
    }

    function selectMode(kind: WalletConfig["kind"]) {
        switch (kind) {
            case "auto_wallet":
                config = { kind: "auto_wallet", minDollarValue: 1 };
                break;
            case "manual_wallet":
                config = { kind: "manual_wallet", tokens: new Set(DEFAULT_TOKENS) };
                break;
        }
    }
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey("cryptoAccount.configureWallet")} />
        </div>
        <div slot="body">
            <div class="select-mode">
                <div
                    on:click={() => selectMode("manual_wallet")}
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
                    on:click={() => selectMode("auto_wallet")}
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
                                    checked={config.tokens.has(token.symbol)}
                                    on:change={() => toggle(token.symbol)}
                                    small
                                    bottomMargin={false}
                                    id={`token_${token.symbol}_toggle`}></Toggle>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
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
        @include font(book, normal, fs-70);
        text-transform: uppercase;
    }

    .auto-mode {
        margin-bottom: 380px;
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
