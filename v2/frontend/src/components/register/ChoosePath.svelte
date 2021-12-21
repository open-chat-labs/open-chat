<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../Button.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
</script>

<h3 class="title">
    {$_("register.choosePath")}
</h3>
<p class="options">{$_("register.regOptions")}</p>
<div class="option-btns">
    <Button on:click={() => dispatch("choosePhoneVerification")}>
        {$_("register.sms")}
    </Button>
    <Button on:click={() => dispatch("chooseTransfer")} secondary={true}>
        {$_("register.transfer")}
    </Button>
</div>

<style type="text/scss">
    .options {
        @include font(light, normal, fs-100);
        margin-bottom: $sp4;
    }

    .option-btns {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: $sp3;
        margin-top: auto;

        @include size-below(xs) {
            flex-direction: column;
        }
    }

    .title {
        @include font(bold, normal, fs-160);
        margin: $sp3 $sp4;
        text-align: center;
        text-shadow: var(--modalPage-txt-sh);
    }
</style>
