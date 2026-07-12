<script lang="ts">
    import { type PincodeChar, type PincodeType } from "./Pincode.svelte";

    interface Props {
        char: PincodeChar;
        type: PincodeType;
        onUpdate: (char: PincodeChar) => void;
        onBlur?: () => void;
        onClear: (char: PincodeChar) => void;
    }

    let { char, type, onUpdate, onBlur, onClear }: Props = $props();

    const android = (navigator.userAgent?.match(/android/i) ?? undefined) !== undefined;
    const androidHack = type === "alphanumeric" && android;

    const KEYBOARD = {
        CONTROL: "Control",
        COMMAND: "Meta",
        V: "v",
        TAB: "Tab",
        BACKSPACE: "Backspace",
    };

    let modifierKeyDown = $state(false);

    function dispatchUpdate(value: string) {
        if (type === "numeric" && /^[0-9]$/.test(value)) {
            onUpdate({ ...char, value });
        }
        if (type === "alphanumeric" && /^[a-zA-Z0-9]$/.test(value)) {
            onUpdate({ ...char, value });
        }
    }

    function onInput(e: Event) {
        if (androidHack) {
            // Get latest char from the input value
            const target = e.target as HTMLInputElement;
            const latestChar = target.value[target.value.length - 1];
            dispatchUpdate(latestChar);
        }
    }
</script>

<input
    type="text"
    inputmode={type === "numeric" ? "numeric" : "text"}
    pattern={type === "numeric" ? "[0-9]{1}" : "^[a-zA-Z0-9]$"}
    maxlength="1"
    value={char.value.length > 0 ? "*" : ""}
    onblur={onBlur}
    oninput={onInput}
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

        // Do not try to update the value from the keydown event if on android, leave that to the input event
        if (!androidHack) {
            dispatchUpdate(e.key);
        }
    }}
    onkeyup={(e) => {
        if (e.key == KEYBOARD.CONTROL || e.key == KEYBOARD.COMMAND) {
            modifierKeyDown = false;
        }
    }} />

<style lang="scss">
    input {
        width: 4rem;
        padding: 0.5rem 1rem;
        margin: 0;
        border: 0;
        border-radius: 0;
        text-align: center;
        background-color: var(--input-bg);
        color: var(--txt);
        @include font(book, normal, fs-130);
        border: var(--bw) solid var(--bd);
        box-shadow: var(--input-sh);

        @include mobile() {
            width: 3rem;
        }
    }

    input:focus {
        z-index: 1;
    }
</style>
