<script lang="ts">
    import Button from "../Button.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";

    let inp: HTMLInputElement;
    let codeValue: string = "";
    onMount(() => inp.focus());

    function submitCode() {
        dispatch("submitCode", { code: parseInt(codeValue, 10) });
    }

    $: codeInvalid = codeValue.length !== 6;
</script>

<p>Enter reg code</p>
<input
    minlength={6}
    maxlength={6}
    placeholder="enter your registration code"
    bind:this={inp}
    class="reg-code"
    bind:value={codeValue} />
<div class="actions">
    <Button disabled={codeInvalid} on:click={submitCode}>Validate Code</Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";
</style>
