<script lang="ts">
    import {
        hasEveryRequiredPermission,
        ValidationErrors,
        type ExternalBotPermissions,
        type SlashCommandSchema,
    } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import ShieldAccount from "svelte-material-icons/ShieldAccount.svelte";
    import { iconSize } from "../../stores/iconSize";

    interface Props {
        grantedPermissions?: ExternalBotPermissions;
        commands: SlashCommandSchema[];
        centered?: boolean;
        onClick?: (command: SlashCommandSchema, index: number) => void;
        errors?: ValidationErrors;
    }

    let { grantedPermissions, commands, centered = false, onClick, errors }: Props = $props();
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
                {#if command.ownerOnly}
                    <ShieldAccount size={$iconSize} color={"var(--txt)"} />
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
