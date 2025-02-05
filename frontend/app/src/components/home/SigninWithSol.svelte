<script lang="ts">
    import { initialize, walletStore } from "../../stores/solana/walletStore";
    import {
        type WalletError,
        type WalletName,
        WalletAdapterNetwork,
    } from "@solana/wallet-adapter-base";
    import { Connection, clusterApiUrl } from "@solana/web3.js";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { CoinbaseWalletAdapter } from "@solana/wallet-adapter-coinbase";
    import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
    import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
    import Button from "../Button.svelte";
    import type { OpenChat, SiwsMessage } from "openchat-client";
    import base58 from "bs58";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");
    const localStorageKey = "walletAdapter";

    export let assumeIdentity = true;

    let connecting: WalletName | undefined = undefined;

    $: ({ publicKey, wallet, connect, select, signMessage } = $walletStore);

    function walletError(error: WalletError): void {
        console.error("WalletError: ", error);
    }

    async function connectWallet(name: WalletName) {
        try {
            connecting = name;
            await select(name);
            await connect();
            if (publicKey && wallet && signMessage) {
                const account = publicKey.toBase58();
                const prepareResponse = await client.siwsPrepareLogin(account);

                if (prepareResponse.kind === "success") {
                    const request = buildSignInRequest(prepareResponse.siwsMessage);
                    const data = new TextEncoder().encode(request);
                    const signResponse = await signMessage(data);
                    const signature = base58.encode(signResponse);
                    await client
                        .signInWithWallet("sol", account, signature, assumeIdentity)
                        .then((resp) => {
                            if (resp.kind === "success") {
                                dispatch("connected", resp);
                            }
                        });
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
                new CoinbaseWalletAdapter(),
                new WalletConnectWalletAdapter({
                    network: WalletAdapterNetwork.Mainnet,
                    options: {
                        projectId: import.meta.env.OC_WALLET_CONNECT_PROJECT_ID!,
                    },
                }),
            ],
            autoConnect: true,
            localStorageKey,
            onError: walletError,
        });
    });

    function buildSignInRequest(siwsMessage: SiwsMessage): string {
        // expiration_time and issued_at are in nanoseconds, convert to milliseconds.
        const expMilliseconds = Number(siwsMessage.expirationTime / BigInt(1000000));
        const issuedAtMilliseconds = Number(siwsMessage.issuedAt / BigInt(1000000));

        let request = `${siwsMessage.domain} wants you to sign in with your Solana account:\n${siwsMessage.address}\n\n`;
        request += `${siwsMessage.statement}\n\n`;
        request += `URI: ${siwsMessage.uri}\n`;
        request += `Version: ${siwsMessage.version}\n`;
        request += `Chain ID: ${siwsMessage.chainId}\n`;
        request += `Nonce: ${siwsMessage.nonce}\n`;
        request += `Issued At: ${new Date(issuedAtMilliseconds).toISOString()}\n`;
        request += `Expiration Time: ${new Date(expMilliseconds).toISOString()}`;
        return request;
    }
</script>

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
