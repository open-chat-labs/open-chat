<script lang="ts">
    import {
        createParamInstancesFromSchema,
        paramInstanceIsValid,
        type FlattenedCommand,
        type SlashCommandParam,
        type SlashCommandParamInstance,
    } from "openchat-shared";
    import CommandParam from "./CommandParam.svelte";
    import { botState } from "./botState.svelte";
    import { getContext, onMount } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";

    interface Props {
        command: FlattenedCommand;
        onCancel: () => void;
    }

    const client = getContext<OpenChat>("client");
    let { command, onCancel }: Props = $props();
    let commandName = $derived(`/${command.name}`);

    onMount(() => {
        botState.selectedCommandParamInstances = createParamInstancesFromSchema(command.params);
    });

    let valid = $derived.by(() => {
        if (botState.selectedCommandParamInstances.length !== command.params?.length) {
            return false;
        }
        const pairs: [SlashCommandParam, SlashCommandParamInstance][] = (command.params ?? []).map(
            (p, i) => [p, botState.selectedCommandParamInstances[i]],
        );
        return pairs.every(([p, i]) => paramInstanceIsValid(p, i));
    });

    function onSubmit() {
        client
            .executeBotCommand(botState.createBotInstance(command))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.failed"));
                }
            })
            .finally(onCancel);
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
                {/each}
            {/if}
        </div>
        <div slot="footer">
            <Button disabled={!valid} on:click={onSubmit} small={!$mobileWidth} tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Submit")} />
            </Button>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
