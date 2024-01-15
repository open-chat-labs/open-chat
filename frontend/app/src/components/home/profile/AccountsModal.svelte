<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContent.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    let showZeroBalance = false;
    let zeroCount = 0;
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">
        <Wallet size={"1.2em"} color={"var(--txt)"} />
        <Translatable resourceKey={i18nKey("wallet")} />
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
        align-items: center;
        gap: $sp3;
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
