<script lang="ts">
    import { BodySmall, Button, Column, Form, Sheet, Subtitle } from "component-lib";
    import { botCommandFailure, botState, OpenChat } from "@client";
    import { random64, shownParams, type FlattenedCommand, type MessageContext } from "@shared";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Translatable from "@shared_components/Translatable.svelte";
    import CommandArg from "./CommandArg.svelte";

    interface Props {
        command: FlattenedCommand;
        onCancel: () => void;
        onCommandSent: () => void;
        messageContext: MessageContext;
    }

    const client = getContext<OpenChat>("client");
    let { command, onCancel, onCommandSent, messageContext }: Props = $props();
    let commandName = $derived(`/${command.name}`);
    let busy = $state(false);
    // The params the form shows, each with the choices it shows, as their conditions have them
    let shown = $derived(shownParams(command.params, botState.selectedCommandArgs));

    function onSubmit(e: Event) {
        e.preventDefault();

        if (!botState.instanceValid) return;
        busy = true;
        client
            .executeBotCommand(
                {
                    kind: "chat_scope",
                    chatId: messageContext.chatId,
                    threadRootMessageIndex: messageContext.threadRootMessageIndex,
                    messageId: random64(),
                },
                botState.createBotInstance(command),
            )
            .then((result) => {
                const failure = botCommandFailure(result);
                if (failure !== undefined) toastStore.showFailureToast(failure);
            });
        onCommandSent();
    }
</script>

<Sheet onDismiss={onCancel}>
    <Column overflow={"visible"} gap={"lg"} padding={"lg"}>
        <Subtitle fontWeight={"bold"}>
            {commandName}
        </Subtitle>
        <Form {onSubmit}>
            {#if command.description}
                <BodySmall>
                    <Translatable resourceKey={i18nKey(command.description)} />
                </BodySmall>
            {/if}
            {#if botState.selectedCommandArgs.length === command?.params?.length}
                {#each shown as param, i}
                    {#if param !== undefined}
                        <CommandArg arg={botState.selectedCommandArgs[i]} {param} />
                    {/if}
                {/each}
            {/if}
        </Form>
        <Button disabled={!botState.instanceValid || busy} loading={busy} onClick={onSubmit}>
            <Translatable resourceKey={i18nKey("Submit")} />
        </Button>
    </Column>
</Sheet>
