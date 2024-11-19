<script lang="ts">
    import type { SlashCommandParam } from "openchat-client";
    import { onMount } from "svelte";

    interface Props {
        param: SlashCommandParam;
        index: number;
        onFocus: (index: number) => void;
        onSubmit: () => void;
    }

    let { param, onFocus, onSubmit, index }: Props = $props();

    let inp: HTMLInputElement;

    onMount(() => {
        if (index === 0) {
            inp.focus();
        }
    });

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            onSubmit();
            e.preventDefault();
        }
    }
</script>

<div class="param">
    <span tabindex="-1" contenteditable="false" class="param-name">{param.name}</span>
    <input
        onfocus={() => onFocus(index)}
        onkeydown={keydown}
        bind:this={inp}
        class="param-input"
        placeholder={param.description} />
</div>

<style lang="scss">
    .param {
        display: flex;

        .param-name {
            border: 1px solid var(--bd);
            padding: $sp1 $sp3;
            border-radius: $sp2 0 0 $sp2;
            background-color: var(--button-bg);
            color: var(--button-txt);
        }

        .param-input {
            background-color: var(--entry-bg);
            border-radius: 0 $sp2 $sp2 0;
            border: 1px solid var(--bd);
            border-left: none;
            color: var(--txt);
            padding: $sp1 $sp3;
            outline: none;
        }
    }
</style>
