<script lang="ts">
    import { botState, mobileWidth, OpenChat } from "openchat-client";
    import { random64, type FlattenedCommand, type MessageContext } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
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
    let form: HTMLFormElement;
    let busy = $state(false);

    onMount(() => {
        setTimeout(() => focusFirstInput(), 100);
    });

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

    function focusFirstInput() {
        if (form === undefined) return;

        const formElements = form.querySelectorAll("input, select, textarea, button, .textbox");
        for (const el of formElements) {
            if (el instanceof HTMLElement && isFocusable(el)) {
                el.focus();

                if (isTextBox(el)) {
                    el.select();
                }
                break;
            }
        }
    }

    function isTextBox(element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement {
        return (
            (element instanceof HTMLInputElement && element.type === "text") ||
            element instanceof HTMLTextAreaElement
        );
    }

    function isFocusable(element: HTMLElement): boolean {
        return (
            !(element as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled &&
            element.offsetParent !== null
        );
    }
</script>

<Overlay dismissible onClose={onCancel}>
    <ModalContent closeIcon onClose={onCancel} overflowVisible={true}>
        {#snippet header()}
            {commandName}
        {/snippet}
        {#snippet body()}
            <form bind:this={form} onsubmit={onSubmit}>
                {#if command.description}
                    <p><Translatable resourceKey={i18nKey(command.description)} /></p>
                {/if}
                {#if botState.selectedCommandArgs.length === command?.params?.length}
                    {#each command?.params ?? [] as param, i}
                        <CommandArg arg={botState.selectedCommandArgs[i]} {param} />
                    {/each}
                {/if}
            </form>
        {/snippet}
        {#snippet footer()}
            <Button
                disabled={!botState.instanceValid || busy}
                loading={busy}
                onClick={onSubmit}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Submit")} />
            </Button>
        {/snippet}
    </ModalContent>
</Overlay>
