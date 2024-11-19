<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { type FlattenedCommand } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { botState } from "./botState.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { onMount } from "svelte";

    interface Props {
        onCancel: () => void;
        onSelect: (command: FlattenedCommand) => void;
    }

    let { onCancel, onSelect }: Props = $props();

    function selectCommand(command: FlattenedCommand) {
        botState.selectedCommand = $state.snapshot(command);
        botState.prefix = `/${command.name}`;
        onSelect(command);
    }

    onMount(() => (botState.error = undefined));
</script>

<div class="command-header">
    <h4>
        {#if botState.selectedCommand !== undefined}
            <Translatable resourceKey={i18nKey(`/${botState.selectedCommand.name}`)} />
        {:else}
            <Translatable resourceKey={i18nKey("bots.matchingCommands")} />
        {/if}
    </h4>
    <HoverIcon onclick={onCancel}>
        <Close size={"1em"} color={"var(--icon-txt)"} />
    </HoverIcon>
</div>
{#if botState.selectedCommand !== undefined}
    <div class="param-help">
        {#if botState.focusedParam !== undefined}
            <p>
                {`${botState.focusedParam.description} (${
                    botState.focusedParam.required ? "required" : "optional"
                })`}
            </p>
        {:else}
            <p>{botState.selectedCommand.description}</p>
        {/if}
    </div>
{:else}
    <div class="command-list">
        {#each botState.commands as command}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="command" onclick={() => selectCommand(command)}>
                <img class="icon" src={command.botIcon} alt={command.botName} />
                <div class="details">
                    <div class="interface">
                        <div class="command-name">
                            /{command.name}
                        </div>
                        {#each command?.params ?? [] as param}
                            <div class="param">{param.name}</div>
                        {/each}
                    </div>
                    <div class="desc">
                        {command.description}
                    </div>
                </div>
                <div class="bot-name">{command.botName}</div>
            </div>
        {/each}
    </div>
{/if}

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

    .param-help {
        padding: $sp4;
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
            display: flex;
            align-items: center;
            gap: $sp3;
            border-bottom: 1px solid var(--bd);
            padding: $sp3;
            cursor: pointer;

            .bot-name {
                @include font(light, normal, fs-80);
                color: var(--txt-light);
            }

            .icon {
                flex: 0 0 50px;
                width: 50px;
                height: 50px;
                aspect-ratio: 1 / 1;
                background-position: center;
                background-repeat: no-repeat;
                background-size: cover;
            }

            .details {
                flex: auto;
                display: flex;
                flex-direction: column;

                .interface {
                    display: flex;
                    align-items: center;
                    gap: $sp2;

                    .command-name {
                        @include font(bold, normal, fs-100);
                    }

                    .param {
                        @include font(light, normal, fs-100);
                        border: 1px solid var(--bd);
                        padding: $sp1 $sp3;
                        border-radius: $sp2;
                    }
                }

                .desc {
                    @include font(light, normal, fs-80);
                }
            }
        }
    }
</style>
