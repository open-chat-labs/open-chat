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
    $: val = min;

    $: console.log(min, max, val);

    function cancel() {
        dispatch("cancel");
    }
</script>

<div class="body">
    <h1>ICP upgrade</h1>

    <div class="slider">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as i}
            <div class="slider-section">
                {`${100 * i}MB`}
            </div>
        {/each}
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

        .slider-section {
            border: 1px solid rgba(0, 0, 0, 0.3);
            flex: auto;
            height: 30px;
        }

        .max {
            @include font(light, normal, fs-80);
            flex: 0 0 50px;
            padding: 0 $sp3;
        }
    }
</style>
