<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import Footer from "./Footer.svelte";
    import { ONE_GB, storageStore } from "stores/storage";

    const dispatch = createEventDispatcher();

    export let mode: "intercepting" | "direct";

    $: min = Math.ceil($storageStore.byteLimit / 100_000_000);
    $: max = Math.ceil(ONE_GB / 100_000_000);

    function cancel() {
        dispatch("cancel");
    }
</script>

<div class="body">
    <h1>SMS upgrade</h1>
    <input type="range" {min} {max} step={1} />
</div>
<Footer>
    <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
    }
</style>
