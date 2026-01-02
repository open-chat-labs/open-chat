<script lang="ts">
    import { BodySmall, Button, Column, Form, Sheet, Subtitle } from "component-lib";
    import { botState, OpenChat } from "openchat-client";
    import { random64, type FlattenedCommand, type MessageContext } from "openchat-shared";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Translatable from "../Translatable.svelte";
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
                if (result === "failure") {
                    toastStore.showFailureToast(i18nKey("bots.failed"));
                } else if (result === "too_many_requests") {
                    toastStore.showFailureToast(i18nKey("bots.tooManyRequests"));
                }
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
                {#each command?.params ?? [] as param, i}
                    <CommandArg arg={botState.selectedCommandArgs[i]} {param} />
                {/each}
            {/if}
        </Form>
        <Button disabled={!botState.instanceValid || busy} loading={busy} onClick={onSubmit}>
            <Translatable resourceKey={i18nKey("Submit")} />
        </Button>
    </Column>
</Sheet>
