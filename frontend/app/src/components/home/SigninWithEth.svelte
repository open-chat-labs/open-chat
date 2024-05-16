<script lang="ts">
    import { createConfig, http, signMessage, type Connector } from "@wagmi/core";
    // import { wagmiConfig } from "../../utils/siwe";
    import {
        coinbaseWallet,
        // injected,
        // walletConnect,
    } from "@wagmi/connectors";
    import { mainnet } from "@wagmi/chains";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { ECDSAKeyIdentity } from "@dfinity/identity";
    import Button from "../Button.svelte";

    const client = getContext<OpenChat>("client");
    let sessionKey: ECDSAKeyIdentity | undefined = undefined;

    const wc = { projectId: process.env.WALLET_CONNECT_PROJECT_ID! };

    console.log("Wallet Connect: ", wc);

    const wagmiConfig = createConfig({
        chains: [mainnet],
        connectors: [
            coinbaseWallet({ appName: "OpenChat" }),
            // injected(),
            // walletConnect(wc),
        ],
        transports: {
            [mainnet.id]: http(),
        },
    });

    async function connectWith(connector: Connector) {
        try {
            if (sessionKey === undefined) {
                sessionKey = await ECDSAKeyIdentity.generate();
            }
            const resp = await connector.connect();
            console.log("response: ", resp, connector.icon);
            if (resp.accounts.length > 0) {
                const account = resp.accounts[0];
                const prepareResponse = await client.siwePrepareLogin(account);
                console.log("Resp: ", prepareResponse);
                if (prepareResponse.kind === "success") {
                    const signResponse = await signMessage(wagmiConfig, {
                        account,
                        connector,
                        message: prepareResponse.siweMessage,
                    });
                    client.signInWithWallet("eth", account, signResponse, sessionKey);
                }
            } else {
                console.error("Didn't get an address back from the connector");
            }
        } catch (err) {
            console.error(`Error connecting to connector: ${connector.name}`, err);
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
        <div class="icon center">
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
    }
</style>
