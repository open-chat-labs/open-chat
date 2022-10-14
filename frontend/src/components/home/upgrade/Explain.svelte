<script lang="ts">
    import { _ } from "svelte-i18n";
    import { ONE_GB } from "openchat-client";
    import Button from "../../Button.svelte";
    import Footer from "./Footer.svelte";
    import Link from "../../Link.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: storageStore = client.storageStore;
    $: storageInGb = client.storageInGb;
    $: smsUpgradePossible = $storageStore.byteLimit === 0;
    $: upgradePossible = $storageStore.byteLimit < ONE_GB;

    function cancel() {
        dispatch("cancel");
    }

    function upgradeIcp() {
        dispatch("upgradeIcp");
    }

    function upgradeSms() {
        dispatch("upgradeSms");
    }

    function whySms() {
        dispatch("showFaqQuestion", "sms_icp");
    }
</script>

<div class="body">
    <p>
        {$_("insufficientStorageAdvice")}
    </p>

    {#if $storageStore.byteLimit > 0}
        <p>
            {#if upgradePossible}
                {$_("usageText", {
                    values: { limit: $storageInGb.gbLimit.toFixed(1) },
                })}
            {:else}
                {$_("maxUsageText")}
            {/if}
        </p>
    {/if}

    <p>
        {$_("explainStorageLimit")}
    </p>

    <!-- depending on whether the user already has storage display one of two messages -->
    {#if upgradePossible}
        <p>
            {#if smsUpgradePossible}
                {$_("chooseUpgrade")}

                <Link underline={"always"} on:click={whySms}>
                    {$_("tellMeMore")}
                </Link>
            {:else}
                {$_("chooseTransfer")}
            {/if}
        </p>
    {/if}
</div>

<Footer>
    {#if upgradePossible}
        {#if smsUpgradePossible}
            <Button on:click={upgradeSms} small={true}>{$_("upgradeBySMS")}</Button>
        {/if}
        <Button on:click={upgradeIcp} small={true}>{$_("upgradeByTransfer")}</Button>
        <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
    {:else}
        <Button small={true} secondary={true} on:click={cancel}>{$_("close")}</Button>
    {/if}
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;

        p {
            margin-bottom: $sp4;
        }
    }
</style>
