<script lang="ts">
    import Button from "../Button.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";

    let inp: HTMLInputElement;
    let phoneNumberStr: string = "";
    onMount(() => inp.focus());

    function submitPhoneNumber() {
        dispatch("submitPhoneNumber", { countryCode: 123, number: 7583748 });
    }

    $: phoneNumberInvalid = phoneNumberStr.length < 3;
</script>

<p class="enter-phone">{$_("register.enterPhone")}</p>
<input
    minlength={3}
    maxlength={25}
    placeholder="enter your phone number"
    bind:this={inp}
    class="username"
    bind:value={phoneNumberStr} />
<div class="actions">
    <Button disabled={phoneNumberInvalid} on:click={submitPhoneNumber}>
        {$_("register.requestCode")}
    </Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";
</style>
