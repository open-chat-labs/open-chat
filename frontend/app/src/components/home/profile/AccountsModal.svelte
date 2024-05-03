<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContent.svelte";
    import CogIcon from "svelte-material-icons/CogOutline.svelte";
    import WalletIcon from "svelte-material-icons/WalletOutline.svelte";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import Translatable from "../../Translatable.svelte";
    import WalletSettings from "./WalletSettings.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    let showZeroBalance = false;
    let zeroCount = 0;
    let showWalletSettings = false;
</script>

{#if showWalletSettings}
    <WalletSettings on:close={() => (showWalletSettings = false)} />
{/if}

<ModalContent on:close>
    <div class="header" slot="header">
        <div class="title">
            <WalletIcon size={"1.2em"} color={"var(--txt)"} />
            <Translatable resourceKey={i18nKey("wallet")} />
        </div>
        <div class="settings" on:click={() => (showWalletSettings = true)}>
            <CogIcon color={"var(--txt)"} />
        </div>
    </div>
    <div slot="body">
        <Accounts bind:showZeroBalance bind:zeroCount />
    </div>
    <div slot="footer">
        <div class="footer">
            <div class="show-more">
                {#if zeroCount > 0}
                    <LinkButton
                        light
                        underline={"hover"}
                        on:click={() => (showZeroBalance = !showZeroBalance)}
                        ><Translatable
                            resourceKey={i18nKey(
                                showZeroBalance
                                    ? "cryptoAccount.hideZeroBalance"
                                    : "cryptoAccount.showZeroBalance",
                            )} /></LinkButton>
                {/if}
            </div>
            <Button on:click={() => dispatch("close")} small={!$mobileWidth} tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        </div>
    </div>
</ModalContent>

<style lang="scss">
    .header {
        display: flex;
        justify-content: space-between;
        gap: $sp3;

        .title {
            display: flex;
            align-items: center;
            gap: $sp3;
        }
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;

        .show-more {
            @include font(light, normal, fs-70);
        }
    }
</style>
