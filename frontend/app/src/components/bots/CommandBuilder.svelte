<script lang="ts">
    import {
        // createParamInstancesFromSchema,
        paramInstanceIsValid,
        type FlattenedCommand,
        type MessageContext,
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
        messageContext: MessageContext;
    }

    const client = getContext<OpenChat>("client");
    let { command, onCancel, messageContext }: Props = $props();
    let commandName = $derived(`/${command.name}`);
    let form: HTMLFormElement;
    let busy = $state(false);

    onMount(() => {
        setTimeout(() => focusFirstInput(), 100);
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

    function onSubmit(e: Event) {
        e.preventDefault();
        busy = true;
        client
            .executeBotCommand(botState.createBotInstance(command, messageContext))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.failed"));
                }
            })
            .finally(() => {
                busy = false;
                onCancel();
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
</script>

<Overlay dismissible on:close={onCancel}>
    <ModalContent closeIcon on:close={onCancel}>
        <div slot="header">{commandName}</div>
        <form bind:this={form} slot="body" onsubmit={onSubmit}>
            {#if command.description}
                <p><Translatable resourceKey={i18nKey(command.description)} /></p>
            {/if}
            {#if botState.selectedCommandParamInstances.length === command?.params?.length}
                {#each command?.params ?? [] as param, i}
                    <CommandParam instance={botState.selectedCommandParamInstances[i]} {param} />
                {/each}
            {/if}
        </form>
        <div slot="footer">
            <Button
                disabled={!valid || busy}
                loading={busy}
                on:click={onSubmit}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Submit")} />
            </Button>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
