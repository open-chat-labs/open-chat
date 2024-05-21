<script lang="ts">
    import { initialize, walletStore } from "../../stores/solana/walletStore";
    import {
        type WalletError,
        type WalletName,
        WalletAdapterNetwork,
    } from "@solana/wallet-adapter-base";
    import { Connection, clusterApiUrl } from "@solana/web3.js";
    import { getContext, onMount } from "svelte";
    import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
    import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
    import Button from "../Button.svelte";
    import type { OpenChat } from "openchat-client";
    import base58 from "bs58";

    const client = getContext<OpenChat>("client");

    const localStorageKey = "walletAdapter";
    let connecting: WalletName | undefined = undefined;

    $: ({ publicKey, wallet, connect, select, signMessage } = $walletStore);
    $: walletsAvailable = $walletStore.wallets.filter(
        (wallet) => wallet.readyState === "Installed",
    ).length;

    function walletError(error: WalletError): void {
        console.error("WalletError: ", error);
    }

    async function connectWallet(name: WalletName) {
        try {
            connecting = name;
            await select(name);
            await connect();
            if (publicKey && wallet && signMessage) {
                const account = publicKey.toString();
                const prepareResponse = await client.siwsPrepareLogin(account);
                console.log("PrepareResponse: ", prepareResponse);
                if (prepareResponse.kind === "success") {
                    // const expMilliseconds = Number(
                    //     prepareResponse.siwsMessage.expirationTime / BigInt(1000000),
                    // );
                    // const issuedAtMilliseconds = Number(
                    //     prepareResponse.siwsMessage.issuedAt / BigInt(1000000),
                    // );

                    // const msg = {
                    //     ...prepareResponse.siwsMessage,
                    //     expirationTime: new Date(expMilliseconds).toISOString(),
                    //     issuedAt: new Date(issuedAtMilliseconds).toISOString(),
                    //     version: prepareResponse.siwsMessage.version.toString(),
                    // };

                    const signResponse = await signMessage(
                        // new TextEncoder().encode(JSON.stringify(msg)),
                        new TextEncoder().encode(JSON.stringify(prepareResponse.siwsMessage)),
                    );
                    const signature = base58.encode(signResponse);

                    console.log("SignResponse: ", signResponse, signature);

                    const signInResponse = await client.signInWithWallet("sol", account, signature);

                    console.log("SignInResponse: ", signInResponse);
                }
            } else {
                console.error("Didn't get an address back from the connector");
            }
        } catch (err) {
            console.error(`Error connecting to wallet: ${name}`, err);
        } finally {
            connecting = undefined;
        }
    }

    onMount(async () => {
        const connection = new Connection(clusterApiUrl("mainnet-beta"), "processed");
        console.log("Connection: ", connection);
        initialize({
            wallets: [
                new PhantomWalletAdapter(),
                new WalletConnectWalletAdapter({
                    network: WalletAdapterNetwork.Mainnet,
                    options: {
                        projectId: process.env.WALLET_CONNECT_PROJECT_ID!,
                    },
                }),
            ],
            autoConnect: true,
            localStorageKey,
            onError: walletError,
        });
    });
</script>

<h1>
    {walletsAvailable
        ? "Connect a wallet to continue"
        : "You'll need a wallet on Solana to continue"}
</h1>

{#each $walletStore.wallets as { adapter: { name, icon } }}
    <div class="auth-option">
        <div class={`icon center ${connecting === name ? "connecting" : ""}`}>
            <img src={icon} alt={`${name} icon`} />
        </div>
        <Button fill on:click={() => connectWallet(name)}>
            <span class="name">{name}</span>
        </Button>
    </div>
{/each}

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
