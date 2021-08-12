<script lang="ts">
    export let group: string = "radio-group";
    export let value: string = "radio-value";
    export let checked: boolean = false;
    export let id: string;
    export let label: string = "radio-label";
</script>

<div class="radio">
    <input {id} type="radio" name={group} {checked} {value} on:change />
    <label for={id}>{label}</label>
</div>

<style type="text/scss">
    .radio {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        cursor: pointer;
    }
    input {
        margin: 0;
        flex: 0 0 40px;
    }

    label {
        flex: 1;
    }
</style>
