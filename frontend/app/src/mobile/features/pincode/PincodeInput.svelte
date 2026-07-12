<script lang="ts">
    import { type PincodeChar } from "./Pincode.svelte";

    interface Props {
        char: PincodeChar;
        onUpdate: (char: PincodeChar) => void;
        onBlur?: () => void;
        onClear: (char: PincodeChar) => void;
    }

    let { char, onUpdate, onBlur, onClear }: Props = $props();

    const KEYBOARD = {
        CONTROL: "Control",
        COMMAND: "Meta",
        V: "v",
        TAB: "Tab",
        BACKSPACE: "Backspace",
    };

    let modifierKeyDown = $state(false);

    function dispatchUpdate(value: string) {
        if (/^[0-9]$/.test(value)) {
            onUpdate({ ...char, value });
        }
    }
</script>

<div class="wrapper">
    <input
        type="text"
        inputmode={"numeric"}
        pattern={"[0-9]{1}"}
        maxlength="1"
        value={char.value.length > 0 ? "*" : ""}
        onblur={onBlur}
        onkeydown={(e) => {
            if (e.key === KEYBOARD.BACKSPACE) {
                e.preventDefault();
                onClear(char);
                return;
            }

            if (e.key == KEYBOARD.CONTROL || e.key == KEYBOARD.COMMAND) {
                modifierKeyDown = true;
            }

            if (e.key == KEYBOARD.V && modifierKeyDown) {
                return;
            }

            if (e.key !== KEYBOARD.TAB) {
                e.preventDefault();
            }

            dispatchUpdate(e.key);
        }}
        onkeyup={(e) => {
            if (e.key == KEYBOARD.CONTROL || e.key == KEYBOARD.COMMAND) {
                modifierKeyDown = false;
            }
        }} />
</div>

<style lang="scss">
    .wrapper {
        position: relative;
        display: flex;
        align-items: flex-end;
        width: 4rem;
        &::after {
            position: absolute;
            bottom: 0;
            left: 0;
            content: "";
            width: 100%;
            height: 6px;
            display: block;
            border-radius: var(--rad-circle);
            background-color: var(--primary);
        }
    }

    input {
        width: 100%;
        padding: 1rem;
        margin: 0;
        border: 0;
        border-radius: 0;
        text-align: center;
        background-color: transparent;
        color: var(--txt);
        @include font(bold, normal, fs-130);

        &:focus {
            outline: none;
        }
    }

    input:focus {
        z-index: 1;
    }
</style>
