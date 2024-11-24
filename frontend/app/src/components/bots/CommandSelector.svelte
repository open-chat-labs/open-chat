<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { type FlattenedCommand } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { botState } from "./botState.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { getContext, onMount } from "svelte";
    import Logo from "../Logo.svelte";
    import type { MessageContext, OpenChat } from "openchat-client";
    import {
        messagePermissionsForSelectedChat,
        threadPermissionsForSelectedChat,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";

    interface Props {
        onCancel: () => void;
        mode: "thread" | "message";
        messageContext: MessageContext;
    }

    const client = getContext<OpenChat>("client");

    let { onCancel, mode, messageContext }: Props = $props();

    let commands = $derived.by(() =>
        botState.commands.filter((c) => {
            return hasPermissionForCommand(c);
        }),
    );

    // We need to check that the user in the current context has all of the permissions that the command requires
    // It's annoying that this can't really be in the botState file because it combines runes and stores
    function hasPermissionForCommand(command: FlattenedCommand): boolean {
        switch (mode) {
            case "message":
                return command.permissions.messagePermissions.every((p) =>
                    $messagePermissionsForSelectedChat.get(p),
                );
            case "thread":
                return command.permissions.messagePermissions.every((p) =>
                    $threadPermissionsForSelectedChat.get(p),
                );
        }
    }

    function selectCommand(command: FlattenedCommand) {
        botState.selectedCommand = $state.snapshot(command);
    }

    onMount(() => {
        botState.error = undefined;
        document.addEventListener("keydown", onkeydown);
        return () => {
            document.removeEventListener("keydown", onkeydown);
        };
    });

    function onkeydown(ev: KeyboardEvent): void {
        switch (ev.key) {
            case "ArrowDown":
                botState.focusPreviousCommand();
                break;
            case "ArrowUp":
                botState.focusNextCommand();
                break;
            case "Enter":
                botState.setSelectedCommand();
                if (botState.selectedCommand && botState.instanceValid) {
                    client
                        .executeBotCommand(
                            botState.createBotInstance(botState.selectedCommand, messageContext),
                        )
                        .then((success) => {
                            if (!success) {
                                toastStore.showFailureToast(i18nKey("bots.failed"));
                            }
                        })
                        .finally(onCancel);
                }
                break;
            case "Escape":
                onCancel();
                break;
        }
    }
</script>

<div class="command-header">
    <h4>
        <Translatable resourceKey={i18nKey("bots.matchingCommands")} />
    </h4>
    <HoverIcon onclick={onCancel}>
        <Close size={"1em"} color={"var(--icon-txt)"} />
    </HoverIcon>
</div>
<div class="command-list">
    {#each commands as command, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="command"
            class:selected={botState.focusedCommandIndex === i}
            onclick={() => selectCommand(command)}>
            {#if command.kind === "external_bot"}
                <img class="icon" src={command.botIcon} alt={command.botName} />
            {:else}
                <Logo />
            {/if}
            <div class="details">
                <div class="interface">
                    <div class="command-name">
                        /{command.name}
                    </div>
                    {#each command?.params ?? [] as param}
                        <div class="param" class:required={param.required}>
                            <Translatable resourceKey={i18nKey(param.name)} />
                        </div>
                    {/each}
                </div>
                {#if command.description}
                    <div class="desc">
                        <Translatable resourceKey={i18nKey(command.description)} />
                    </div>
                {/if}
            </div>
            <div class="bot-name">
                <Translatable resourceKey={i18nKey(command.botName)} />
            </div>
        </div>
    {/each}
</div>

{#if botState.error !== undefined}
    <div class="command-error">
        <ErrorMessage>
            {botState.error}
        </ErrorMessage>
    </div>
{/if}

<style lang="scss">
    .command-error {
        :global(h4) {
            margin-bottom: 0;
        }
    }

    .command-header {
        background-color: var(--modal-bg);
        padding: $sp3 $sp4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--bd);
        border-top: 1px solid var(--bd);
    }

    .command-list {
        position: relative;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        background-color: var(--modal-bg);

        .command {
            $size: 48px;
            display: flex;
            align-items: center;
            gap: $sp3;
            border-bottom: 1px solid var(--bd);
            padding: $sp3;
            cursor: pointer;

            :global(.logo) {
                width: $size;
                height: $size;
            }

            &.selected {
                background-color: var(--chatSummary-bg-selected);
            }

            .bot-name {
                @include font(light, normal, fs-80);
                color: var(--txt-light);
            }

            .icon {
                flex: 0 0 $size;
                width: $size;
                height: $size;
                aspect-ratio: 1 / 1;
                background-position: center;
                background-repeat: no-repeat;
                background-size: cover;
                border-radius: $sp2;
            }

            .details {
                flex: auto;
                display: flex;
                flex-direction: column;

                .interface {
                    display: flex;
                    align-items: center;
                    gap: $sp3;

                    .command-name {
                        @include font(bold, normal, fs-100);
                    }

                    .param {
                        @include font(light, normal, fs-80);
                        border: 1px solid var(--button-bg);
                        padding: $sp1 $sp3;
                        border-radius: $sp2;
                        line-height: 18px;

                        &.required {
                            background-color: var(--button-bg);
                            color: var(--button-txt);
                            border: none;
                        }
                    }
                }

                .desc {
                    @include font(light, normal, fs-80);
                }
            }
        }
    }
</style>
