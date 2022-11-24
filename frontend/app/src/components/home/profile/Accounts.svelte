<script lang="ts">
    import { Cryptocurrency, cryptoCurrencyList, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import { _ } from "svelte-i18n";
    import LinkButton from "../../LinkButton.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    let balanceError: string | undefined;
    let showManageCryptoAccount = false;
    let selectedCryptoAccount: Cryptocurrency | undefined = undefined;

    $: cryptoBalance = client.cryptoBalance;

    function onBalanceRefreshed() {
        balanceError = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        balanceError = ev.detail;
    }

    function showManageCrypto(crypto: Cryptocurrency) {
        selectedCryptoAccount = crypto;
        showManageCryptoAccount = true;
    }
</script>

{#if showManageCryptoAccount && selectedCryptoAccount !== undefined}
    <ManageCryptoAccount bind:token={selectedCryptoAccount} bind:open={showManageCryptoAccount} />
{/if}

<table class="accounts">
    <thead>
        <tr>
            <th colspan="2" class="token">{$_("cryptoAccount.token")}</th>
            <th class="balance">{$_("cryptoAccount.shortBalanceLabel")}</th>
            <th class="manage" />
        </tr>
    </thead>
    <tbody>
        {#if process.env.ENABLE_MULTI_CRYPTO}
            {#each cryptoCurrencyList as token}
                <tr>
                    <td class="icon">@</td>
                    <td class="token">{token.toUpperCase()}</td>
                    <td class="balance"
                        ><BalanceWithRefresh
                            {token}
                            value={$cryptoBalance[token]}
                            on:refreshed={onBalanceRefreshed}
                            on:error={onBalanceRefreshError} /></td>
                    <td class="manage">
                        <LinkButton underline={"hover"} on:click={() => showManageCrypto(token)}
                            >{$_("cryptoAccount.manage")}</LinkButton>
                    </td>
                </tr>
            {/each}
        {:else}
            <tr>
                <td class="icon">@</td>
                <td class="token">ICP</td>
                <td class="balance"
                    ><BalanceWithRefresh
                        token={"icp"}
                        value={$cryptoBalance["icp"]}
                        on:refreshed={onBalanceRefreshed}
                        on:error={onBalanceRefreshError} /></td>
                <td class="manage">
                    <LinkButton underline={"hover"} on:click={() => showManageCrypto("icp")}
                        >{$_("cryptoAccount.manage")}</LinkButton>
                </td>
            </tr>
            <tr>
                <td class="icon">@</td>
                <td class="token"
                    >BTC <span class="coming-soon">{$_("cryptoAccount.comingSoon")}</span></td>
                <td class="balance">
                    <BalanceWithRefresh value={BigInt(0)} disabled />
                </td>
                <td class="manage" />
            </tr>
            <tr>
                <td class="icon">@</td>
                <td class="token"
                    >CHAT <span class="coming-soon">{$_("cryptoAccount.comingSoon")}</span></td>
                <td class="balance">
                    <BalanceWithRefresh value={BigInt(0)} disabled />
                </td>
                <td class="manage" />
            </tr>
        {/if}
    </tbody>
</table>
{#if balanceError !== undefined}
    <ErrorMessage>{balanceError}</ErrorMessage>
{/if}

<style type="text/scss">
    table.accounts {
        width: 100%;
        th,
        td {
            padding: $sp3;
        }
        .token {
            text-align: left;
        }
        th.balance {
            padding-right: 38px;
            @include mobile() {
                padding-right: 34.2px;
            }
        }
        .balance,
        .manage {
            text-align: right;
        }
    }
</style>
