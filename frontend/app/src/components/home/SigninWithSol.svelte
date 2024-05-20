<script lang="ts">
    import { onMount } from "svelte";
    import { clusterApiUrl, Connection } from "@solana/web3.js";
    import { walletStore, initialize } from "@svelte-on-solana/wallet-adapter-core";
    import type { WalletError } from "@solana/wallet-adapter-base";
    import type { WalletName } from "@solana/wallet-adapter-base";
    // import {
    //     //  workSpace,
    //     WalletProvider,
    //     WalletMultiButton,
    //     ConnectionProvider,
    //     walletStore,
    // } from "@svelte-on-solana/wallet-adapter-ui";
    import {
        PhantomWalletAdapter,
        SolflareWalletAdapter,
        TorusWalletAdapter,
    } from "@solana/wallet-adapter-wallets";
    import Button from "../Button.svelte";

    const localStorageKey = "walletAdapter";

    $: ({ publicKey, wallet, disconnect, connect, select } = $walletStore);
    $: walletsAvailable = $walletStore.wallets.filter(
        (wallet) => wallet.readyState === "Installed",
    ).length;

    function walletError(error: WalletError): void {
        console.error("WalletError: ", error);
    }

    async function connectWallet(name: WalletName) {
        await select(name);
        await connect();
    }

    onMount(async () => {
        const connection = new Connection(clusterApiUrl("mainnet-beta"), "processed");
        console.log("Connection: ", connection);
        const wallets = [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
        ];
        initialize({ wallets, autoConnect: true, localStorageKey, onError: walletError });
    });
</script>

<h1>
    {walletsAvailable
        ? "Connect a wallet to continue"
        : "You'll need a wallet on Solana to continue"}
</h1>

{#each $walletStore.wallets as { adapter: { name, icon }, readyState }}
    <div class="auth-option">
        <div class={`icon center`}>
            <img src={icon} alt={`${name} icon`} />
        </div>
        <Button fill on:click={() => connectWallet(name)}>
            <span class="name">{name}</span>
            <span>{readyState === "Installed" ? "Detected" : ""}</span>
        </Button>
    </div>
{/each}

<div>
    <slot />
</div>

<style lang="scss">
    $height: 45px;

    .auth-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: auto;
        max-width: 440px;
        width: 100%;
        align-self: center;
    }

    .icon {
        flex: 0 0 60px;
        width: 60px;
        height: $height;
        border-radius: $sp2 0 0 $sp2;
        border-right: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--input-bg);

        img {
            height: 32px;
            width: 32px;
        }

        &.connecting {
            @include loading-spinner(
                1.2em,
                0.6em,
                var(--button-spinner),
                "/assets/plain-spinner.svg"
            );

            img {
                filter: grayscale(100%);
            }
        }
    }
</style>
