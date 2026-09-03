<script lang="ts">
    import { EXTERNAL_WALLETS_ENABLED, SIGNER_WALLETS, type SignerWallet } from "@client";
    import { Body, ColourVars, Column, Row, Sheet, Subtitle } from "component-lib";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const OPENCHAT_LOGO = "/assets/oc_logo_no_bg.svg";

    interface Props {
        // The external wallet the payment will come from, or undefined for the user's own OpenChat
        // account, which is where payments have always come from
        wallet?: SignerWallet;
    }

    let { wallet = $bindable() }: Props = $props();

    let choosing = $state(false);

    function choose(chosen: SignerWallet | undefined) {
        wallet = chosen;
        choosing = false;
    }
</script>

{#if EXTERNAL_WALLETS_ENABLED}
    <Row onClick={() => (choosing = true)} width={"hug"} crossAxisAlignment={"center"} gap={"sm"}>
        <!-- The same size as the balance text alongside, but in the label colour -->
        <Body colour={"textSecondary"} width={"hug"}>
            <Translatable resourceKey={i18nKey("externalWallet.sourceWallet")} />
        </Body>
        <img class="wallet-logo" alt={wallet?.name ?? "OpenChat"} src={wallet?.logo ?? OPENCHAT_LOGO} />
        <ChevronDown size={"1.5rem"} color={ColourVars.textSecondary} />
    </Row>

    {#if choosing}
        <Sheet onDismiss={() => (choosing = false)}>
            <Column gap={"lg"} padding={"xl"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("externalWallet.sourceWallet")} />
                </Subtitle>
                <Row onClick={() => choose(undefined)} crossAxisAlignment={"center"} gap={"md"}>
                    <img class="wallet-logo large" alt="OpenChat" src={OPENCHAT_LOGO} />
                    <Body fontWeight={wallet === undefined ? "bold" : "normal"}>OpenChat</Body>
                </Row>
                {#each SIGNER_WALLETS as w (w.id)}
                    <Row onClick={() => choose(w)} crossAxisAlignment={"center"} gap={"md"}>
                        <img class="wallet-logo large" alt={w.name} src={w.logo} />
                        <Body fontWeight={wallet?.id === w.id ? "bold" : "normal"}>{w.name}</Body>
                    </Row>
                {/each}
            </Column>
        </Sheet>
    {/if}
{/if}

<style lang="scss">
    .wallet-logo {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;

        &.large {
            width: 2.5rem;
            height: 2.5rem;
        }
    }
</style>
