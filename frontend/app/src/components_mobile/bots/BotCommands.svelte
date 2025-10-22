<script lang="ts">
    import { Tooltip } from "component-lib";
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
    import Pill from "../Pill.svelte";

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
        {@const iconColor = permitted ? "var(--button-txt)" : "var(--button-hollow-txt)"}
        <Tooltip enable={permitted} position="bottom" align="middle">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <Pill
                error={errors?.has(`command_${i}`)}
                onClick={() => onClick?.(command, i)}
                disabled={!permitted}>
                <div class="command">
                    {#if command.defaultRole >= ROLE_ADMIN}
                        <ShieldAccount size={"1rem"} color={iconColor} />
                    {/if}
                    {#if commandSupportsDirectMessages(command)}
                        <SwapHorizontal size={"1rem"} color={iconColor} />
                    {/if}
                    {`/${command.name}`}
                </div>
            </Pill>
            {#snippet popup()}
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
            display: flex;
            align-items: center;
            gap: $sp2;
            @include font(book, normal, fs-80);
            cursor: pointer;
            padding: $sp2;
        }
    }
</style>
