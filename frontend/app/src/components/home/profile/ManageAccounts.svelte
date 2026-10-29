<script lang="ts">
    import {
        cryptoTokensSorted as accountsSorted,
        cryptoLookup,
        defaultWalletLedgers,
        OpenChat,
        walletConfigStore,
    } from "@client";
    import { WalletSettingsForm } from "@src/logic/wallet/walletSettingsForm.svelte";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import MultiToggle, { type Option } from "../../MultiToggle.svelte";
    import Overlay from "../../Overlay.svelte";
    import Search from "../../Search.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
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

    // the settings form (logic/wallet), shared with the other trees: edits a copy of the stored
    // config, saved on close only if it differs
    const form = new WalletSettingsForm(
        client,
        () => walletConfigStore.value,
        () => defaultWalletLedgers($cryptoLookup.values()),
    );

    onMount(() => {
        if (form.config.kind === "manual_wallet") {
            // Refresh balances of disabled tokens so that we discover which
            // ones have non-zero balances are therefore should be searchable
            refreshDisabledTokenBalances();
        }

        return () => void saveOnClose();
    });

    async function saveOnClose(): Promise<void> {
        const outcome = await form.save();
        if (outcome === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.configureWalletFailure"));
        } else if (outcome === "invalid") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.invalidMinimum"));
        }
    }

    function refreshDisabledTokenBalances() {
        for (const token of $cryptoLookup.values()) {
            if (!token.enabled) {
                client.refreshAccountBalance(token.ledger, true);
            }
        }
    }

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
                        onclick={() => form.selectMode("manual_wallet")}
                        class="mode-label"
                        class:selected={form.config.kind === "manual_wallet"}>
                        <Translatable resourceKey={i18nKey("cryptoAccount.manual")} />
                    </div>
                    <Toggle
                        checked={form.config.kind === "auto_wallet"}
                        onChange={() => form.toggleMode()}
                        small
                        bottomMargin={false}
                        id={"wallet-mode-select"}></Toggle>
                    <div
                        onclick={() => form.selectMode("auto_wallet")}
                        class="mode-label"
                        class:selected={form.config.kind === "auto_wallet"}>
                        <Translatable resourceKey={i18nKey("cryptoAccount.auto")} />
                    </div>
                </div>
                {#if form.config.kind === "auto_wallet"}
                    <div class="auto-mode">
                        <div class="info">
                            <Translatable resourceKey={i18nKey("cryptoAccount.autoInfo")} />
                        </div>
                        <Legend label={i18nKey("cryptoAccount.minDollarPlaceholder")} />
                        <Input
                            invalid={!form.valid}
                            bind:value={form.config.minDollarValue}
                            placeholder={i18nKey("cryptoAccount.minDollarPlaceholder")} />
                    </div>
                {:else if form.config.kind === "manual_wallet"}
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
                                        allowCached={true}
                                        conversion={selectedConversion} />
                                    <Toggle
                                        checked={form.config.tokens.has(token.ledger)}
                                        onChange={() => form.toggleToken(token.ledger)}
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
