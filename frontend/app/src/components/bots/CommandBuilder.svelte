<script lang="ts">
    import {
        // createParamInstancesFromSchema,
        type FlattenedCommand,
        type MessageContext,
    } from "openchat-shared";
    import CommandParam from "./CommandParam.svelte";
    import { createBotInstance, instanceValid, selectedCommandParamInstances } from "./botState";
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

        if (!$instanceValid) return;
        busy = true;
        client
            .executeBotCommand(createBotInstance(command, messageContext))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.failed"));
                }
            })
            .finally(() => {
                busy = false;
                onCommandSent();
            });
    }

    function focusFirstInput() {
        if (form === undefined) return;

        const formElements = form.querySelectorAll("input, select, textarea, button");
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

    function onParamChange() {
        // this is a nasty little hack to get the reactivity we need
        setTimeout(() => {
            $selectedCommandParamInstances = $selectedCommandParamInstances;
        }, 0);
    }
</script>

<Overlay dismissible on:close={onCancel}>
    <ModalContent closeIcon on:close={onCancel}>
        <div slot="header">{commandName}</div>
        <form bind:this={form} slot="body" onsubmit={onSubmit}>
            {#if command.description}
                <p><Translatable resourceKey={i18nKey(command.description)} /></p>
            {/if}
            {#if $selectedCommandParamInstances.length === command?.params?.length}
                {#each command?.params ?? [] as param, i}
                    <CommandParam
                        onChange={onParamChange}
                        instance={$selectedCommandParamInstances[i]}
                        {param} />
                {/each}
            {/if}
        </form>
        <div slot="footer">
            <Button
                disabled={!$instanceValid || busy}
                loading={busy}
                on:click={onSubmit}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Submit")} />
            </Button>
        </div>
    </ModalContent>
</Overlay>
