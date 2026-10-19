<script lang="ts">
    import { signMessage, type Connector } from "@wagmi/core";
    import { ethWagmiConfig } from "@src/utils/wagmi";
    import { ethWalletIcon, uniqueByName } from "@src/utils/ethWallets";
    import { OpenChat } from "@client";
    import { getContext } from "svelte";
    import Button from "../Button.svelte";
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";

    const client = getContext<OpenChat>("client");

    interface Props {
        assumeIdentity?: boolean;
        onConnected?: (args: {
            kind: "success";
            key: ECDSAKeyIdentity;
            delegation: DelegationChain;
        }) => void;
    }

    let { assumeIdentity = true, onConnected }: Props = $props();

    let connecting: Connector | undefined = $state();

    const wagmiConfig = ethWagmiConfig();

    const uniqueConnectors = uniqueByName(wagmiConfig.connectors);

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
                    client
                        .signInWithWallet("eth", account, signResponse, assumeIdentity)
                        .then((resp) => {
                            if (resp.kind === "success") {
                                onConnected?.(resp);
                            }
                        });
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
</script>

{#each uniqueConnectors as connector}
    <div class="auth-option">
        <div class={`icon center ${connecting?.id === connector.id ? "connecting" : ""}`}>
            {#if ethWalletIcon(connector)}
                <img alt={connector.name} src={ethWalletIcon(connector)} />
            {/if}
        </div>
        <Button fill onClick={() => connectWith(connector)}>
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
