<script lang="ts">
    import TuneVertical from "svelte-material-icons/TuneVertical.svelte";
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContent.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { _ } from "svelte-i18n";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import ManageTokens from "./ManageTokens.svelte";

    const dispatch = createEventDispatcher();

    let showZeroBalance = false;
    let zeroCount = 0;
    let mode: "manage" | "wallet" = "wallet";
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">
        <Wallet size={"1.2em"} color={"var(--txt)"} />
        {$_("wallet")}
    </div>
    <div slot="body">
        {#if mode === "wallet"}
            <Accounts bind:showZeroBalance bind:zeroCount />
        {:else if mode === "manage"}
            <ManageTokens on:close={() => mode === "wallet"} />
        {/if}
    </div>
    <div slot="footer">
        <div class="footer">
            {#if zeroCount > 0}
                <div class="show-more">
                    <TuneVertical size={$iconSize} color={"var(--icon-txt)"} />
                    <LinkButton light underline={"hover"} on:click={() => (mode = "manage")}
                        >{$_("cryptoAccount.manage")}</LinkButton>
                </div>
            {/if}
            <Button on:click={() => dispatch("close")} small={!$mobileWidth} tiny={$mobileWidth}>
                {$_("close")}
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
