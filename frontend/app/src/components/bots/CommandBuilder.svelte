<script lang="ts">
    import { type FlattenedCommand } from "openchat-shared";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";

    interface Props {
        command: FlattenedCommand;
    }

    let { command }: Props = $props();

    let commandName = $derived(`/${command.name}`);
    let focus = $state(command.params?.[0]);
</script>

{#if focus?.kind === "user"}
    <SingleUserSelector placeholder={focus.description} direction={"up"} autofocus={false} />
{/if}
<div contenteditable class="command-entry">
    <span class="command">{commandName}</span>
    {#each command?.params ?? [] as param}
        <div class="param">
            <span class="param-name">{param.name}</span>
            <input class="param-input" />
        </div>
    {/each}
</div>

<style lang="scss">
    .command-entry {
        padding: toRem(12) $sp4 $sp3 $sp4;
        background-color: var(--entry-input-bg);
        border-radius: var(--entry-input-rd);
        outline: none;
        border: 0;
        min-height: toRem(25);
        overflow-x: hidden;
        overflow-y: auto;
        user-select: text;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: var(--bw) solid var(--entry-input-bd);
        box-shadow: var(--entry-input-sh);
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .param {
        display: flex;
        gap: $sp2;

        .param-name {
            border: 1px solid var(--bd);
            padding: $sp2;
        }
    }
</style>
