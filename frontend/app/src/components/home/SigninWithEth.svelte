<script lang="ts">
    import { createConfig, http, signMessage, type Connector } from "@wagmi/core";
    // import { wagmiConfig } from "../../utils/siwe";
    import {
        coinbaseWallet,
        // injected,
        // walletConnect
    } from "@wagmi/connectors";
    import { mainnet } from "@wagmi/chains";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { ECDSAKeyIdentity } from "@dfinity/identity";

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

    function connectorIcon(connector: Connector): string | undefined {
        if (connector.id === "walletConnect") {
            return "/assets/walletconnect.svg";
        }
        return connector.icon;
    }
</script>

<h1>Select a wallet to connect with</h1>

{#each wagmiConfig.connectors as connector}
    <div class="connector" on:click={() => connectWith(connector)}>
        {#if connectorIcon(connector) !== undefined}
            <img class="icon" src={connector.icon} />
        {/if}
        <span class="name">{connector.name}</span>
    </div>
{/each}

<style lang="scss">
    .connector {
        cursor: pointer;
        border: var(--bw) solid var(--bd);
        border-radius: var(--br);
        padding: $sp3;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: $sp3;
    }
</style>
