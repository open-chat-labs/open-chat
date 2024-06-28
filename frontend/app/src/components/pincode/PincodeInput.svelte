<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { type PincodeChar, type PincodeType } from "./Pincode.svelte";

    const dispatch = createEventDispatcher();

    export let char: PincodeChar;
    export let type: PincodeType;
    export let selectTextOnFocus: boolean = false;

    let ref: HTMLInputElement | undefined;
    let userAgent = navigator.userAgent;

    const android = userAgent?.match(/android/i);
    const KEYBOARD = {
        CONTROL: "Control",
        COMMAND: "Meta",
        V: "v",
        TAB: "Tab",
        BACKSPACE: "Backspace",
    };

    let modifierKeyDown = false;

    function onInput(e: Event) {
        const target = e.target as HTMLInputElement;
        if (android) {
            // Get latest char from the input value
            const latestChar = target.value[target.value.length - 1];
            // Update value according to input type, as was done on the on:keyup event
            if (type === "numeric" && /^[0-9]$/.test(latestChar)) {
                dispatch("update", { ...char, value: latestChar });
            }
            if (type === "alphanumeric" && /^[a-zA-Z0-9]$/.test(latestChar)) {
                dispatch("update", { ...char, value: latestChar });
            }
        }
    }
</script>

<input
    bind:this={ref}
    type={type === "numeric" ? "number" : "text"}
    inputmode={type === "numeric" ? "numeric" : "text"}
    pattern={type === "numeric" ? "[0-9]{1}" : "^[a-zA-Z0-9]$"}
    maxlength="1"
    value={char.value}
    on:focus={() => {
        if (selectTextOnFocus) ref?.select();
    }}
    on:blur
    on:input={onInput}
    on:keydown={(e) => {
        if (e.key === KEYBOARD.BACKSPACE) {
            e.preventDefault();
            dispatch("clear", char);
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
        if (!android) {
            if (type === "numeric" && /^[0-9]$/.test(e.key)) {
                dispatch("update", { ...char, value: e.key });
            }
            if (type === "alphanumeric" && /^[a-zA-Z0-9]$/.test(e.key)) {
                dispatch("update", { ...char, value: e.key });
            }
        }
    }}
    on:keyup={(e) => {
        if (e.key == KEYBOARD.CONTROL || e.key == KEYBOARD.COMMAND) {
            modifierKeyDown = false;
        }
    }} />

<style lang="scss">
    input {
        width: 3rem;
        padding: 0.5rem 1rem;
        margin: 0;
        border: 0;
        border-radius: 0;
        text-align: center;
    }

    input:focus {
        z-index: 1;
    }

    input:not(:last-of-type) {
        border-right: 1px solid #e0e0e0;
    }
</style>
