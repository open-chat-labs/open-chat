<script lang="ts">
    import { createParamInstancesFromSchema, type FlattenedCommand } from "openchat-shared";
    import CommandParam from "./CommandParam.svelte";
    import { botState } from "./botState.svelte";
    import { onMount } from "svelte";

    interface Props {
        command: FlattenedCommand;
    }

    let { command }: Props = $props();

    let commandName = $derived(`/${command.name}`);
    let numberOfParams = $derived(command.params?.length ?? 0);

    onMount(() => {
        botState.selectedCommandParamInstances = createParamInstancesFromSchema(command.params);
    });

    function onFocus(index: number) {
        if (index === numberOfParams) {
            console.log("We will validate at this point");
        } else {
            botState.focusedParamIndex = index;
        }
    }

    function onSubmit() {
        // at this point we validate all of the parameters
        // if there are no errors we can send the command
        // otherwise select the first invalid param and show its
        // error message
    }
</script>

<div contenteditable class="command-entry">
    <span contenteditable="false" tabindex="-1" class="command">{commandName}</span>
    {#if botState.selectedCommandParamInstances.length === command?.params?.length}
        {#each command?.params ?? [] as param, i}
            <CommandParam
                instance={botState.selectedCommandParamInstances[i]}
                {onSubmit}
                index={i}
                {onFocus}
                {param} />
        {/each}
    {/if}
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
</style>
