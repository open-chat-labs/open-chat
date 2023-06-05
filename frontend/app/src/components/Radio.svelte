<script lang="ts">
    export let group: string = "radio-group";
    export let value: string = "radio-value";
    export let checked: boolean = false;
    export let id: string;
    export let label: string = "radio-label";
    export let align: "center" | "start" = "center";
    export let disabled: boolean = false;
</script>

<div class="radio" class:align-start={align === "start"}>
    <input {disabled} {id} type="radio" name={group} {checked} {value} on:change />
    <label for={id}>
        <slot>
            {label}
        </slot>
    </label>
</div>

<style lang="scss">
    .radio {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        cursor: pointer;
        gap: $sp4;

        &.align-start {
            align-items: flex-start;

            input {
                margin-top: 6px;
            }
        }
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

    input[type="radio"]:disabled {
        --color: var(--txt-light);
        color: var(--txt-light);
        cursor: not-allowed;
    }

    input[type="radio"]::before {
        content: "";
        width: 0.75em;
        height: 0.75em;
        border-radius: 50%;
        transform: scale(0);
        transition: 50ms transform ease-in-out;
        box-shadow: inset 1em 1em var(--input-accent);
    }

    input[type="radio"]:checked::before {
        transform: scale(1);
    }

    label {
        cursor: pointer;
        flex: 1;
    }
</style>
