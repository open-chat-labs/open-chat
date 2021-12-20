<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../Button.svelte";
    import { createEventDispatcher } from "svelte";

    export let amount: bigint;

    const dispatch = createEventDispatcher();
</script>

<h3 class="title">
    {$_("register.confirmTransfer")}
</h3>
<p class="options">
    {$_("register.confirmTransferText", {
        values: { amount: amount.toString() },
    })}
</p>
<p class="canister">
    {"process.env.USER_INDEX_CANISTER"}
</p>
<div>
    <Button on:click={() => dispatch("transferConfirmed")}>
        {$_("register.confirmed")}
    </Button>
</div>

<style type="text/scss">
    .options {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }

    .canister {
        @include font(bold, normal, fs-100);
        margin-bottom: $sp4;
    }

    .title {
        @include font(bold, normal, fs-160);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
