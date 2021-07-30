<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    export let checked: boolean = false;
    export let disabled: boolean = false;
    export let id: string;
    export let label: string;
    export let toggle: boolean = false;
</script>

<div class="checkbox" class:toggle class:rtl={$rtlStore}>
    <input {id} type="checkbox" {checked} {disabled} on:change />
    <label for={id}>{label}</label>
</div>

<style type="text/scss">
    $size: 32px;

    // todo - this will have rtl issues at the moment

    input {
        margin: 0;
        margin-right: $sp4;
    }

    .checkbox {
        display: flex;
        align-items: center;
        cursor: pointer;

        &.rtl input {
            margin-left: $sp4;
            margin-right: unset;
        }
    }

    label {
        flex: 1;
        user-select: none;
    }

    .toggle {
        input {
            display: none;
        }

        label {
            transition: background-color 200ms ease-in-out;
            cursor: pointer;
            text-indent: -9999px;
            width: 80px;
            height: 36px;
            background: var(--button-bg);
            display: block;
            border-radius: 18px;
            position: relative;
        }

        label:after {
            content: "";
            position: absolute;
            top: 2px;
            left: 2px;
            width: $size !important;
            height: $size;
            background: #fff;
            border-radius: 50%;
            transition: 150ms ease-in-out;
        }

        input:checked + label {
            background-color: var(--accent);
        }

        input:checked + label:after {
            left: calc(100% - 2px);
            transform: translateX(-100%);
        }

        label:active:after {
            width: 60px;
        }
    }
</style>
