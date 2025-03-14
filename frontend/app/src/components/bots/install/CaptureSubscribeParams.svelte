<script lang="ts">
    import { createArgsFromSchema, type FlattenedCommand } from "openchat-client";
    import CommandParam from "../CommandArg.svelte";
    import Legend from "@src/components/Legend.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { instanceIsValid } from "../botState";

    interface Props {
        command: FlattenedCommand;
        valid: boolean;
    }

    let { command, valid = $bindable() }: Props = $props();

    let args = $state(createArgsFromSchema(command.params, []));

    $effect(() => {
        const isValid = instanceIsValid(command, args);
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    function onParamChange() {
        console.log("Param changed");
    }
</script>

<Legend large label={i18nKey("bots.add.subscribeParams")}></Legend>
{#each command.params as param, i}
    <CommandParam onChange={onParamChange} arg={args[i]} {param} />
{/each}
