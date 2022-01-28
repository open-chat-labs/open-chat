<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import Footer from "./Footer.svelte";
    import { ONE_GB, storageInMb, storageStore } from "stores/storage";

    const dispatch = createEventDispatcher();

    export let mode: "intercepting" | "direct";

    let range: HTMLInputElement;
    let amount: number = 0.1;
    let account: string = "lkasd64aadkadlkjasd;lkja;dasd;jsdlkjlKSDflkjdflkjsdf;";

    $: min = Math.ceil($storageStore.byteLimit / 100_000_000);
    $: max = Math.ceil(ONE_GB / 100_000_000);
    $: newLimit = min;

    function cancel() {
        dispatch("cancel");
    }

    function changeLimit(e: Event) {
        const num = Number(range.value);
        if (num < min) {
            (e.target as HTMLInputElement).value = min.toString();
            newLimit = min;
            e.preventDefault();
            return false;
        }
        newLimit = num;
    }
</script>

<div class="body">
    <p>{min}</p>
    <p>{newLimit}</p>

    {#if $storageStore.byteLimit > 0}
        <p>{$_("currentLimit", { values: { limit: $storageInMb.mbLimit.toString() } })}</p>
    {/if}

    <div class="summary">
        <span>Your current storage limit is 100MB</span>
        <span>1GB</span>
    </div>

    <div class="slider">
        <div class="range">
            <input
                class="range-input"
                bind:this={range}
                type="range"
                min={0}
                {max}
                value={newLimit}
                on:input={changeLimit} />
        </div>
    </div>
</div>
<Footer>
    <Button small={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
</Footer>

<style type="text/scss">
    .body {
        padding: $sp4 $sp5;
    }
    .slider {
        display: flex;
        width: 100%;
        @include font(light, normal, fs-60);

        .range {
            flex: auto;
        }

        .range-input {
            width: 100%;
        }
    }
</style>
