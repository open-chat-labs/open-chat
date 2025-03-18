<script lang="ts">
    import {
        hasEveryRequiredPermission,
        ValidationErrors,
        type ExternalBotPermissions,
        type CommandDefinition,
    } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import ShieldAccount from "svelte-material-icons/ShieldAccount.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";

    interface Props {
        grantedPermissions?: ExternalBotPermissions;
        commands: CommandDefinition[];
        centered?: boolean;
        onClick?: (command: CommandDefinition, index: number) => void;
        errors?: ValidationErrors;
    }

    let { grantedPermissions, commands, centered = false, onClick, errors }: Props = $props();

    function commandSupportsDirectMessages(command: CommandDefinition): boolean {
        return command.directMessages && command.params[0]?.kind === "string";
    }
</script>

<div class="commands" class:centered>
    {#each commands as command, i}
        {@const permitted =
            grantedPermissions === undefined ||
            hasEveryRequiredPermission(command.permissions, grantedPermissions)}
        <TooltipWrapper enable={permitted} position="bottom" align="middle">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                slot="target"
                class="command"
                onclick={() => onClick?.(command, i)}
                class:command-error={errors?.has(`command_${i}`)}
                class:not_permitted={!permitted}>
                {#if command.defaultRole === "owner" || command.defaultRole === "admin"}
                    <ShieldAccount size={"1rem"} color={"var(--button-txt)"} />
                {/if}
                {#if commandSupportsDirectMessages(command)}
                    <SwapHorizontal size={"1rem"} color={"var(--button-txt)"} />
                {/if}
                {`/${command.name}`}
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {align} {position}>
                    {command.description}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/each}
</div>

<style lang="scss">
    .commands {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: $sp3;
        margin-bottom: $sp4;

        @include mobile() {
            gap: $sp2;
        }

        &.centered {
            justify-content: center;
        }

        .command {
            @include font(book, normal, fs-80);
            background-color: var(--button-bg);
            border: 1px solid var(--button-bg);
            color: var(--button-txt);
            padding: $sp3 $sp4;
            border-radius: $sp2;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: $sp3;

            @include mobile() {
                padding: $sp2 $sp3;
            }

            &.not_permitted {
                background-color: unset;
                color: var(--txt);
                opacity: 0.8;
            }

            &.command-error {
                background-color: var(--error);
            }
        }
    }
</style>
