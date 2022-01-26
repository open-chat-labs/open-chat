<script lang="ts">
    import Checkbox from "../../Checkbox.svelte";
    import { _ } from "svelte-i18n";

    export let checked: boolean = false;
    export let disabled: boolean = false;
    export let label: string;
    export let id: string;
</script>

<div class="toggle-wrapper">
    <div class="toggle">
        <Checkbox {disabled} {id} toggle={true} on:change {label} bind:checked />
    </div>
    <div class="label">
        {label}
    </div>
</div>

<style type="text/scss">
    .toggle-wrapper {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
        .toggle {
            flex: 0 0 40px;
        }
        .label {
            flex: 1;
        }
    }
</style>
