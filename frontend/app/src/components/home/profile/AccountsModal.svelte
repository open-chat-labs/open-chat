<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import Accounts from "./Accounts.svelte";
</script>

<ModalContent closeIcon on:close>
    <div slot="header">{$_("wallet")}</div>
    <div slot="body">
        <Accounts />
    </div>
</ModalContent>
