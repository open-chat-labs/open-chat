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
        gap: $sp4;
    }

    input {
        margin: 0;
        flex: 0 0 1.15em;
        cursor: pointer;
    }

    input[type="radio"] {
        appearance: none;
        background-color: transparent;
        margin: 0;
        font: inherit;
        color: currentColor;
        width: 1.15em;
        height: 1.15em;
        border: 1px solid currentColor;
        border-radius: 50%;
        transform: translateY(-0.075em);

        display: grid;
        place-content: center;
    }

    input[type="radio"]::before {
        content: "";
        width: 0.75em;
        height: 0.75em;
        border-radius: 50%;
        transform: scale(0);
        transition: 50ms transform ease-in-out;
        box-shadow: inset 1em 1em var(--button-bg);
    }

    input[type="radio"]:checked::before {
        transform: scale(1);
    }

    label {
        cursor: pointer;
        flex: 1;
    }
</style>
