<script lang="ts">
    import {
        commandSupportsDirectMessages,
        hasEveryRequiredPermission,
        ROLE_ADMIN,
        ValidationErrors,
        type CommandDefinition,
        type GrantedBotPermissions,
    } from "openchat-client";
    import ShieldAccount from "svelte-material-icons/ShieldAccount.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";
    import Tooltip from "../tooltip/Tooltip.svelte";

    interface Props {
        grantedPermissions?: GrantedBotPermissions;
        commands: CommandDefinition[];
        centered?: boolean;
        onClick?: (command: CommandDefinition, index: number) => void;
        errors?: ValidationErrors;
    }

    let { grantedPermissions, commands, centered = false, onClick, errors }: Props = $props();
</script>

<div class="commands" class:centered>
    {#each commands as command, i}
        {@const permitted =
            grantedPermissions?.command === undefined ||
            hasEveryRequiredPermission(command.permissions, grantedPermissions.command)}
        <Tooltip enable={permitted} position="bottom" align="middle">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="command"
                onclick={() => onClick?.(command, i)}
                class:command-error={errors?.has(`command_${i}`)}
                class:not_permitted={!permitted}>
                {#if command.defaultRole >= ROLE_ADMIN}
                    <ShieldAccount size={"1rem"} color={"var(--button-txt)"} />
                {/if}
                {#if commandSupportsDirectMessages(command)}
                    <SwapHorizontal size={"1rem"} color={"var(--button-txt)"} />
                {/if}
                {`/${command.name}`}
            </div>
            {#snippet popupTemplate()}
                {command.description}
            {/snippet}
        </Tooltip>
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
