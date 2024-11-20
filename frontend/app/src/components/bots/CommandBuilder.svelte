<script lang="ts">
    import { createParamInstancesFromSchema, type FlattenedCommand } from "openchat-shared";
    import CommandParam from "./CommandParam.svelte";
    import { botState } from "./botState.svelte";
    import { onMount } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        command: FlattenedCommand;
        onCancel: () => void;
    }

    let { command, onCancel }: Props = $props();

    let commandName = $derived(`/${command.name}`);

    onMount(() => {
        botState.selectedCommandParamInstances = createParamInstancesFromSchema(command.params);
    });

    function onSubmit() {
        // let's validate the instance against the schema and if it's ok, submit the command
        // Might leave that for now until we have more of the framework in place
        onCancel();
    }
</script>

<Overlay>
    <ModalContent on:close={onCancel}>
        <div slot="header">{commandName}</div>
        <div slot="body">
            <p>{command.description}</p>
            {#if botState.selectedCommandParamInstances.length === command?.params?.length}
                {#each command?.params ?? [] as param, i}
                    <CommandParam
                        instance={botState.selectedCommandParamInstances[i]}
                        index={i}
                        {param} />
                    <pre>{JSON.stringify(botState.selectedCommandParamInstances[i], null, 4)}</pre>
                {/each}
            {/if}
        </div>
        <div slot="footer">
            <Button on:click={onSubmit} small={!$mobileWidth} tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Submit")} />
            </Button>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
