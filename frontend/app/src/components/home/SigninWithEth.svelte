<script lang="ts">
    import { createConfig, http, signMessage, type Connector } from "@wagmi/core";
    import { coinbaseWallet, walletConnect } from "@wagmi/connectors";
    import { mainnet } from "@wagmi/chains";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Button from "../Button.svelte";

    const client = getContext<OpenChat>("client");

    let connecting: Connector | undefined;

    const wagmiConfig = createConfig({
        chains: [mainnet],
        connectors: [
            coinbaseWallet({ appName: "OpenChat" }),
            walletConnect({ projectId: process.env.WALLET_CONNECT_PROJECT_ID! }),
        ],
        transports: {
            [mainnet.id]: http(),
        },
    });

    async function connectWith(connector: Connector) {
        try {
            connecting = connector;
            const resp = await connector.connect();
            if (resp.accounts.length > 0) {
                const account = resp.accounts[0];
                const prepareResponse = await client.siwePrepareLogin(account);
                if (prepareResponse.kind === "success") {
                    const signResponse = await signMessage(wagmiConfig, {
                        account,
                        connector,
                        message: prepareResponse.siweMessage,
                    });
                    client.signInWithWallet("eth", account, signResponse);
                }
            } else {
                console.error("Didn't get an address back from the connector");
            }
        } catch (err) {
            console.error(`Error connecting to connector: ${connector.name}`, err);
        } finally {
            connecting = undefined;
        }
    }

    let icons: Record<string, string> = {
        walletConnect: "/assets/walletconnect.svg",
        coinbaseWalletSDK: "/assets/coinbase.svg",
    };
</script>

<h1>Select a wallet to connect with</h1>

{#each wagmiConfig.connectors as connector}
    <div class="auth-option">
        <div class={`icon center ${connecting === connector ? "connecting" : ""}`}>
            {#if icons[connector.id] ?? connector.icon}
                <img alt={connector.name} src={icons[connector.id] ?? connector.icon} />
            {/if}
        </div>
        <Button fill on:click={() => connectWith(connector)}>
            <span class="name">{connector.name}</span>
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
