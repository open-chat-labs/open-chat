<script lang="ts" context="module">
    export type PincodeType = "alphanumeric" | "numeric";
    export type PincodeChar = {
        idx: number;
        value: string;
    };
</script>

<script lang="ts">
    import { createEventDispatcher, afterUpdate } from "svelte";
    import PincodeInput from "./PincodeInput.svelte";

    export let length: number;
    export let code: string[] = [];
    export let value: string = "";
    export let type: PincodeType = "alphanumeric";
    export let complete: boolean = false;
    export let selectTextOnFocus: boolean = false;

    function initialise(length: number): PincodeChar[] {
        return [...Array(length).keys()].map((idx) => ({ idx, value: "" }));
    }

    const dispatch = createEventDispatcher();
    $: characters = initialise(length);

    let ref: HTMLDivElement | undefined = undefined;
    let prevValue = value;

    function setCode() {
        code = characters.map((char) => char.value || "");
    }

    function getInputs() {
        return ref?.querySelectorAll("input") ?? [];
    }

    function focusNextInput(idx: number) {
        const inputs = getInputs();
        const nextInput = inputs[idx + 1];
        nextInput?.focus();
    }

    function clear(ev: CustomEvent<PincodeChar>) {
        if (!characters[ev.detail.idx].value) {
            const inputs = getInputs();
            const prevInput = inputs[ev.detail.idx - 1];
            prevInput?.focus();
            prevInput?.select();
        }
        characters = characters.map((char, i) => {
            if (i === ev.detail.idx) return { ...char, value: "" };
            return char;
        });
        setCode();
    }

    function update(ev: CustomEvent<PincodeChar>) {
        characters = characters.map((char, idx) => {
            if (idx === ev.detail.idx) return ev.detail;
            return char;
        });
        setCode();
        focusNextInput(ev.detail.idx);
    }

    afterUpdate(() => {
        if (complete) dispatch("complete", { code, value });
    });

    function handlePaste(e: ClipboardEvent) {
        e.preventDefault();
        code =
            e.clipboardData
                ?.getData("text")
                .split("")
                .filter((it) => it !== " ") ?? [];
    }

    $: value = code.join("");
    $: complete = code.length > 0 && code.filter(Boolean).length === characters.length;
    $: if (code) {
        characters = characters.map((char, i) => ({ ...char, value: code[i] }));
    }
    $: if (code.length === 0) {
        characters = characters.map((char) => ({ ...char, value: "" }));
    }
    $: {
        if (prevValue !== value && value.length === 0) {
            dispatch("clear");
        }
        prevValue = value;
    }
</script>

<div class="pincode" bind:this={ref} on:paste={handlePaste}>
    {#each characters as char}
        <PincodeInput on:update={update} on:clear={clear} {type} {selectTextOnFocus} bind:char />
    {/each}
</div>

<style lang="scss">
    .pincode {
        display: inline-flex;
        gap: $sp3;
    }
</style>
