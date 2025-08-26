<script lang="ts" module>
    export type PincodeType = "alphanumeric" | "numeric";
    export type PincodeChar = {
        idx: number;
        value: string;
    };
</script>

<script lang="ts">
    import PincodeInput from "./PincodeInput.svelte";

    interface Props {
        length?: number;
        code?: string[];
        type?: PincodeType;
        onClear?: () => void;
        onComplete?: (code: string[], value: string) => void;
    }

    let {
        length = 6,
        code = $bindable([]),
        type = "numeric",
        onClear,
        onComplete,
    }: Props = $props();

    function initialise(length: number): PincodeChar[] {
        return [...Array(length).keys()].map((idx) => ({ idx, value: "" }));
    }

    let characters = $state(initialise(length));
    let ref: HTMLDivElement | undefined = $state();
    let prevValue = $state("");
    let value = $derived(code.join(""));
    let complete = $derived(code.length > 0 && code.filter(Boolean).length === characters.length);

    $effect(() => {
        if (prevValue !== value && value.length === 0) {
            onClear?.();
        }
        prevValue = value;
    });

    $effect(() => {
        if (complete) onComplete?.(code, value);
    });

    function charactersFromCode() {
        characters = code.map((char, idx) => ({ idx, value: char }));
    }

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

    function onClearCharacter(character: PincodeChar) {
        if (!characters[character.idx].value) {
            const inputs = getInputs();
            const prevInput = inputs[character.idx - 1];
            prevInput?.focus();
            prevInput?.select();
        }
        characters = characters.map((char, i) => {
            if (i === character.idx) return { ...char, value: "" };
            return char;
        });
        setCode();
    }

    function onUpdateCharacter(character: PincodeChar) {
        characters = characters.map((char, idx) => {
            if (idx === character.idx) return character;
            return char;
        });
        setCode();
        focusNextInput(character.idx);
    }

    function handlePaste(e: ClipboardEvent) {
        e.preventDefault();
        code = (
            e.clipboardData
                ?.getData("text")
                .split("")
                .filter((it) => it !== " ") ?? []
        ).slice(0, length);
        charactersFromCode();
    }
</script>

<div class="pincode" bind:this={ref} onpaste={handlePaste}>
    {#each characters as char}
        <PincodeInput onUpdate={onUpdateCharacter} onClear={onClearCharacter} {type} {char} />
    {/each}
</div>

<style lang="scss">
    .pincode {
        display: inline-flex;
        gap: $sp3;
    }
</style>
