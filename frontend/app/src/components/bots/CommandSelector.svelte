<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { getBots } from "./testBots";
    import { onMount } from "svelte";
    import { type ExternalBot, type FlattenedCommand } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        prefix: string;
        onCancel: () => void;
        onSelect: (command: FlattenedCommand) => void;
    }

    onMount(async () => {
        bots = await getBots();
    });

    let { onCancel, onSelect, prefix = "" }: Props = $props();

    let parsedPrefix = $derived(prefix.slice(1).toLocaleLowerCase());
    let bots = $state<ExternalBot[]>([]);
    let commands = $derived.by(() => {
        return bots.flatMap((b) => {
            return b.commands
                .map((c) => ({
                    ...c,
                    botName: b.name,
                    botIcon: b.icon,
                    botDescription: b.description,
                }))
                .filter((c) => {
                    return (
                        c.name.toLocaleLowerCase().includes(parsedPrefix) ||
                        c.description?.toLocaleLowerCase()?.includes(parsedPrefix)
                    );
                });
        });
    });

    function selectCommand(command: FlattenedCommand) {
        prefix = `/${command.name}`;
        onSelect(command);
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
    {#each commands as command}
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

<style lang="scss">
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
