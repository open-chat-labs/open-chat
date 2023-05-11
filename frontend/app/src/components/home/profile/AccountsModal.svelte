<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { _ } from "svelte-i18n";
    import Accounts from "./Accounts.svelte";
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">
        <Wallet size={"1.2em"} color={"var(--txt)"} />
        {$_("wallet")}
    </div>
    <div slot="body">
        <Accounts />
    </div>
</ModalContent>

<style type="text/scss">
    .header {
        display: flex;
        align-items: center;
        gap: $sp3;
    }
</style>
