<script lang="ts">
    import type { Adapter } from "@solana/wallet-adapter-base";
    import { onMount } from "svelte";
    import { clusterApiUrl, Connection, Commitment, ConnectionConfig } from "@solana/web3.js";
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

    const localStorageKey = "walletAdapter";

    let wallets: Adapter[];

    onMount(async () => {
        const connection = new Connection(clusterApiUrl("mainnet-beta"), "processed");
        wallets = [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
        ];
    });
</script>

<h1>Why is my laptop so utterly shit?</h1>

<WalletProvider {localStorageKey} {wallets} autoConnect />
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
