<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import Footer from "./Footer.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    function cancel() {
        dispatch("cancel");
    }

    function upgradeIcp() {
        dispatch("upgradeIcp");
    }

    function upgradeSms() {
        dispatch("upgradeSms");
    }
</script>

<div class="body">
    {$_("premium.blurb")}
</div>

<Footer>
    <Button on:click={upgradeSms} small={true}>{$_("upgradeBySMS")}</Button>
    <Button on:click={upgradeIcp} small={true}>{$_("upgradeByTransfer")}</Button>
    <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5 $sp5 $sp5;
    }
</style>
